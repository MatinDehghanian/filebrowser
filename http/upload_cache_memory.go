package fbhttp

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jellydator/ttlcache/v3"
)

var errUploadMissing = errors.New("no active upload found for the given path")

const uploadCacheTTL = 24 * time.Hour

// UploadCache is an interface for tracking active uploads.
// Allows for different backends (e.g. in-memory or redis)
// to support both single instance and multi replica deployments.
type UploadCache interface {
	// Register stores an upload with its expected file size
	Register(filePath string, fileSize int64, remove func() error, fingerprint string, overwrite bool)

	// Complete removes an upload from the cache
	Complete(filePath string)

	// GetLength returns the expected file size for an active upload
	GetLength(filePath string) (int64, error)

	Metadata(filePath string) (string, bool, error)

	// Touch refreshes the TTL for an active upload
	Touch(filePath string)

	// Close cleans up any resources
	Close()
}

// memoryUploadCache is an upload cache for single replica deployments
type uploadEntry struct {
	fingerprint string
	overwrite   bool
	length      int64
	remove      func() error
}

type memoryUploadCache struct {
	cache *ttlcache.Cache[string, uploadEntry]
}

func newMemoryUploadCache() *memoryUploadCache {
	cache := ttlcache.New[string, uploadEntry]()
	cache.OnEviction(func(_ context.Context, reason ttlcache.EvictionReason, item *ttlcache.Item[string, uploadEntry]) {
		if reason == ttlcache.EvictionReasonExpired {
			fmt.Printf("deleting incomplete upload file: \"%s\"\n", item.Key())
			if remove := item.Value().remove; remove != nil {
				if err := remove(); err != nil {
					fmt.Printf("upload cleanup failed: %v\n", err)
				}
			}
		}
	})
	go cache.Start()

	return &memoryUploadCache{cache: cache}
}

func (c *memoryUploadCache) Register(filePath string, fileSize int64, remove func() error, fingerprint string, overwrite bool) {
	c.cache.Set(filePath, uploadEntry{length: fileSize, remove: remove, fingerprint: fingerprint, overwrite: overwrite}, uploadCacheTTL)
}

func (c *memoryUploadCache) Complete(filePath string) {
	c.cache.Delete(filePath)
}

func (c *memoryUploadCache) GetLength(filePath string) (int64, error) {
	item := c.cache.Get(filePath)
	if item == nil {
		return 0, errUploadMissing
	}
	return item.Value().length, nil
}

func (c *memoryUploadCache) Metadata(path string) (string, bool, error) {
	item := c.cache.Get(path)
	if item == nil {
		return "", false, fmt.Errorf("upload expired")
	}
	return item.Value().fingerprint, item.Value().overwrite, nil
}

func (c *memoryUploadCache) Touch(filePath string) {
	c.cache.Touch(filePath)
}

func (c *memoryUploadCache) Close() {
	c.cache.Stop()
}

// NewUploadCache creates a new upload cache.
// If redisURL is empty, an in-memory cache will be used (suitable for single instance deployments).
// Otherwise, Redis will be used for the cache (suitable for multi-instance deployments).
// The redisURL can include credentials, e.g. redis://user:pass@host:port
func NewUploadCache(redisURL string) (UploadCache, error) {
	if redisURL != "" {
		return newRedisUploadCache(redisURL)
	}
	return newMemoryUploadCache(), nil
}
