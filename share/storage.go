package share

import (
	"errors"
	"strings"
	"time"

	fberrors "github.com/MatinDehghanian/filebrowser/v2/errors"
)

// StorageBackend is the interface to implement for a share storage.
type StorageBackend interface {
	All() ([]*Link, error)
	FindByUserID(id uint) ([]*Link, error)
	GetByHash(hash string) (*Link, error)
	GetPermanent(path string, id uint) (*Link, error)
	Gets(path string, id uint) ([]*Link, error)
	Save(s *Link) error
	Delete(hash string) error
	DeleteWithPathPrefix(path string) error
}

// Storage is a storage.
type Storage struct {
	back StorageBackend
}

// NewStorage creates a share links storage from a backend.
func NewStorage(back StorageBackend) *Storage {
	return &Storage{back: back}
}

// All wraps a StorageBackend.All.
func (s *Storage) All() ([]*Link, error) {
	links, err := s.back.All()

	if err != nil {
		return nil, err
	}

	return s.withoutExpired(links)
}

func (s *Storage) withoutExpired(links []*Link) ([]*Link, error) {
	active := make([]*Link, 0, len(links))
	for _, link := range links {
		if link.Expire != 0 && link.Expire <= time.Now().Unix() {
			if err := s.Delete(link.Hash); err != nil {
				return nil, err
			}
			continue
		}
		active = append(active, link)
	}

	return active, nil
}

// FindByUserID wraps a StorageBackend.FindByUserID.
func (s *Storage) FindByUserID(id uint) ([]*Link, error) {
	links, err := s.back.FindByUserID(id)

	if err != nil {
		return nil, err
	}

	return s.withoutExpired(links)
}

// GetByHash wraps a StorageBackend.GetByHash.
func (s *Storage) GetByHash(hash string) (*Link, error) {
	link, err := s.back.GetByHash(hash)
	if err != nil {
		return nil, err
	}

	if link.Expire != 0 && link.Expire <= time.Now().Unix() {
		if err := s.Delete(link.Hash); err != nil {
			return nil, err
		}
		return nil, fberrors.ErrNotExist
	}

	return link, nil
}

// GetPermanent wraps a StorageBackend.GetPermanent
func (s *Storage) GetPermanent(path string, id uint) (*Link, error) {
	return s.back.GetPermanent(path, id)
}

// Gets wraps a StorageBackend.Gets
func (s *Storage) Gets(path string, id uint) ([]*Link, error) {
	links, err := s.back.Gets(path, id)

	if err != nil {
		return nil, err
	}

	return s.withoutExpired(links)
}

// Save wraps a StorageBackend.Save
func (s *Storage) Save(l *Link) error {
	return s.back.Save(l)
}

// Delete wraps a StorageBackend.Delete
func (s *Storage) Delete(hash string) error {
	return s.back.Delete(hash)
}

func (s *Storage) DeleteWithPathPrefix(path string) error {
	return s.back.DeleteWithPathPrefix(path)
}

// UpdateUserPaths keeps other users' links and similarly named siblings intact.
// An empty destination deletes links associated with the removed resource.
func (s *Storage) UpdateUserPaths(userID uint, source, destination string) error {
	links, err := s.FindByUserID(userID)
	if errors.Is(err, fberrors.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	source = strings.TrimRight(source, "/")
	for _, link := range links {
		if link.Path != source && !strings.HasPrefix(link.Path, source+"/") {
			continue
		}
		if destination == "" {
			err = s.Delete(link.Hash)
		} else {
			link.Path = strings.TrimRight(destination, "/") + strings.TrimPrefix(link.Path, source)
			err = s.Save(link)
		}
		if err != nil {
			return err
		}
	}
	return nil
}
