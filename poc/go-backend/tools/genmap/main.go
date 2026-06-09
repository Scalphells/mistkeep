// Command genmap renders a simple top-down battlemap PNG for documentation
// screenshots (no external assets, pure stdlib). Usage: go run . <out.png>
package main

import (
	"image"
	"image/color"
	"image/png"
	"math"
	"os"
)

const (
	W    = 1280
	H    = 960
	cell = 64 // grid cell size in px
)

func main() {
	img := image.NewRGBA(image.Rect(0, 0, W, H))

	grass := color.RGBA{58, 84, 56, 255}
	grassAlt := color.RGBA{64, 92, 60, 255}
	path := color.RGBA{120, 102, 72, 255}
	water := color.RGBA{46, 78, 110, 255}
	rock := color.RGBA{96, 96, 104, 255}
	tree := color.RGBA{36, 60, 40, 255}

	for y := 0; y < H; y++ {
		for x := 0; x < W; x++ {
			c := grass
			if (x/cell+y/cell)%2 == 0 {
				c = grassAlt
			}
			// Diagonal dirt path across the map.
			d := math.Abs(float64(y) - (0.7*float64(x) + 120))
			if d < 70 {
				c = path
			}
			// A pond in the lower-left.
			if dist(x, y, 300, 760) < 150 {
				c = water
			}
			// A few rock clusters.
			if dist(x, y, 980, 300) < 55 || dist(x, y, 1060, 360) < 40 {
				c = rock
			}
			// Tree clumps along the top-right.
			if dist(x, y, 1120, 140) < 70 || dist(x, y, 1000, 90) < 55 || dist(x, y, 860, 170) < 48 {
				c = tree
			}
			img.Set(x, y, c)
		}
	}

	// Grid overlay.
	grid := color.RGBA{0, 0, 0, 60}
	for x := 0; x <= W; x += cell {
		for y := 0; y < H; y++ {
			blend(img, x, y, grid)
		}
	}
	for y := 0; y <= H; y += cell {
		for x := 0; x < W; x++ {
			blend(img, x, y, grid)
		}
	}

	out := "battlemap.png"
	if len(os.Args) > 1 {
		out = os.Args[1]
	}
	f, err := os.Create(out)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		panic(err)
	}
}

func dist(x, y, cx, cy int) float64 {
	dx, dy := float64(x-cx), float64(y-cy)
	return math.Sqrt(dx*dx + dy*dy)
}

func blend(img *image.RGBA, x, y int, c color.RGBA) {
	if x < 0 || x >= W || y < 0 || y >= H {
		return
	}
	base := img.RGBAAt(x, y)
	a := float64(c.A) / 255
	img.SetRGBA(x, y, color.RGBA{
		R: uint8(float64(base.R)*(1-a) + float64(c.R)*a),
		G: uint8(float64(base.G)*(1-a) + float64(c.G)*a),
		B: uint8(float64(base.B)*(1-a) + float64(c.B)*a),
		A: 255,
	})
}
