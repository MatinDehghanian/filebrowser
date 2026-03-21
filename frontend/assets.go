//go:build !dev

package frontend

import "embed"

//go:embed out/*
var assets embed.FS

func Assets() embed.FS {
	return assets
}
