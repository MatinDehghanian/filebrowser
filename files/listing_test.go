package files

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestNameSorting(t *testing.T) {
	for _, asc := range []bool{true, false} {
		listing := Listing{Sorting: Sorting{By: "name", Asc: asc}, Items: []*FileInfo{{Name: "file10"}, {Name: "directory", IsDir: true}, {Name: "file2"}, {Name: "File1"}}}
		listing.ApplySort()
		require.True(t, listing.Items[0].IsDir)
		expected := []string{"File1", "file2", "file10"}
		if !asc {
			expected = []string{"file10", "file2", "File1"}
		}
		for i, name := range expected {
			require.Equal(t, name, listing.Items[i+1].Name)
		}
	}
}
