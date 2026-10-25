package fbhttp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
)

type redisUploadInfo struct {
	Length      int64
	Fingerprint string
	Overwrite   bool
}

// redisUploadCache is an upload cache for multi replica deployments
type redisUploadCache struct {
	client *redis.Client
}

func newRedisUploadCache(redisURL string) (*redisUploadCache, error) {
	if redisURL == "" {
		return nil, fmt.Errorf("redis URL is required")
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	// Test connection
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return &redisUploadCache{client: client}, nil
}

func (c *redisUploadCache) filePathKey(filePath string) string {
	return "filebrowser:upload:" + filePath
}

func (c *redisUploadCache) Register(filePath string, fileSize int64, _ func() error, fingerprint string, overwrite bool) {
	payload, _ := json.Marshal(redisUploadInfo{fileSize, fingerprint, overwrite})
	err := c.client.Set(context.Background(), c.filePathKey(filePath), payload, uploadCacheTTL).Err()
	if err != nil {
		log.Printf("failed to register upload in redis cache: %v", err)
	}
}

func (c *redisUploadCache) Complete(filePath string) {
	err := c.client.Del(context.Background(), c.filePathKey(filePath)).Err()
	if err != nil {
		log.Printf("failed to complete upload in redis cache: %v", err)
	}
}

func (c *redisUploadCache) GetLength(filePath string) (int64, error) {
	result, err := c.client.Get(context.Background(), c.filePathKey(filePath)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return 0, errUploadMissing
		}
		return 0, fmt.Errorf("redis error: %w", err)
	}

	var info redisUploadInfo
	if err := json.Unmarshal([]byte(result), &info); err != nil {
		return 0, err
	}
	size := info.Length

	c.Touch(filePath)
	return size, nil
}

func (c *redisUploadCache) Metadata(path string) (string, bool, error) {
	v, err := c.client.Get(context.Background(), c.filePathKey(path)).Result()
	if err != nil {
		return "", false, err
	}
	var info redisUploadInfo
	err = json.Unmarshal([]byte(v), &info)
	return info.Fingerprint, info.Overwrite, err
}

func (c *redisUploadCache) Touch(filePath string) {
	err := c.client.Expire(context.Background(), c.filePathKey(filePath), uploadCacheTTL).Err()
	if err != nil {
		log.Printf("failed to touch upload in redis cache: %v", err)
	}
}

func (c *redisUploadCache) Close() {
	c.client.Close()
}
