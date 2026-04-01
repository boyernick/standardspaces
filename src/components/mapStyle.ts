import mapboxgl from "mapbox-gl";

const LIGHT_LAYERS: mapboxgl.LayerSpecification[] = [
  { id: "land", type: "background", paint: { "background-color": "#f7f7f3" } },
  { id: "water", type: "fill", source: "composite", "source-layer": "water", paint: { "fill-color": "#eceae2" } },
  { id: "landuse-park", type: "fill", source: "composite", "source-layer": "landuse", filter: ["==", "class", "park"], paint: { "fill-color": "#eeede5" } },
  { id: "building", type: "fill", source: "composite", "source-layer": "building", paint: { "fill-color": "#e5e4dc", "fill-opacity": 0.8 } },
  { id: "road-minor", type: "line", source: "composite", "source-layer": "road", filter: ["all", ["==", "$type", "LineString"], ["in", "class", "street", "street_limited", "service"]], paint: { "line-color": "#ffffff", "line-width": 1.5 } },
  { id: "road-major", type: "line", source: "composite", "source-layer": "road", filter: ["all", ["==", "$type", "LineString"], ["in", "class", "primary", "secondary", "tertiary"]], paint: { "line-color": "#ffffff", "line-width": 2.5 } },
  { id: "road-highway", type: "line", source: "composite", "source-layer": "road", filter: ["all", ["==", "$type", "LineString"], ["in", "class", "motorway", "trunk"]], paint: { "line-color": "#ffffff", "line-width": 4 } },
  { id: "road-highway-casing", type: "line", source: "composite", "source-layer": "road", filter: ["all", ["==", "$type", "LineString"], ["in", "class", "motorway", "trunk"]], paint: { "line-color": "#e0dfd7", "line-width": 6, "line-gap-width": 0 }, layout: { "line-cap": "round" } },
  { id: "admin-boundary", type: "line", source: "composite", "source-layer": "admin", paint: { "line-color": "#d5d4ca", "line-width": 1.2, "line-dasharray": [3, 2] } },
  { id: "road-label", type: "symbol", source: "composite", "source-layer": "road", filter: ["in", "class", "motorway", "trunk", "primary", "secondary"], minzoom: 13, layout: { "text-field": "{name}", "text-size": 11, "symbol-placement": "line", "text-max-angle": 30 }, paint: { "text-color": "#a3a295", "text-halo-color": "#f7f7f3", "text-halo-width": 1.5 } },
  { id: "place-city", type: "symbol", source: "composite", "source-layer": "place_label", filter: ["<=", "symbolrank", 6], layout: { "text-field": "{name}", "text-size": ["step", ["get", "symbolrank"], 18, 4, 15, 6, 13], "text-letter-spacing": 0.05, "text-transform": "none" }, paint: { "text-color": "#4a4940", "text-halo-color": "#f7f7f3", "text-halo-width": 2 } },
  { id: "place-neighborhood", type: "symbol", source: "composite", "source-layer": "place_label", filter: ["all", [">", "symbolrank", 6], ["<=", "symbolrank", 15]], minzoom: 11, layout: { "text-field": "{name}", "text-size": 11, "text-letter-spacing": 0.08, "text-transform": "uppercase", "text-padding": 8 }, paint: { "text-color": "#a3a295", "text-halo-color": "#f7f7f3", "text-halo-width": 1.5 } },
  { id: "water-label", type: "symbol", source: "composite", "source-layer": "natural_label", filter: ["<=", "symbolrank", 4], layout: { "text-field": "{name}", "text-size": 11 }, paint: { "text-color": "#c0bfb3", "text-halo-color": "#eceae2", "text-halo-width": 1 } },
];

const DARK_LAYERS: mapboxgl.LayerSpecification[] = [
  { id: "land", type: "background", paint: { "background-color": "#13120A" } },
  { id: "water", type: "fill", source: "composite", "source-layer": "water", paint: { "fill-color": "#0e0d07" } },
  { id: "landuse-park", type: "fill", source: "composite", "source-layer": "landuse", filter: ["==", "class", "park"], paint: { "fill-color": "#1c1b12" } },
  { id: "building", type: "fill", source: "composite", "source-layer": "building", paint: { "fill-color": "#25241a", "fill-opacity": 0.8 } },
  { id: "road-minor", type: "line", source: "composite", "source-layer": "road", filter: ["all", ["==", "$type", "LineString"], ["in", "class", "street", "street_limited", "service"]], paint: { "line-color": "#333224", "line-width": 1.5 } },
  { id: "road-major", type: "line", source: "composite", "source-layer": "road", filter: ["all", ["==", "$type", "LineString"], ["in", "class", "primary", "secondary", "tertiary"]], paint: { "line-color": "#3e3d2e", "line-width": 2.5 } },
  { id: "road-highway", type: "line", source: "composite", "source-layer": "road", filter: ["all", ["==", "$type", "LineString"], ["in", "class", "motorway", "trunk"]], paint: { "line-color": "#464434", "line-width": 4 } },
  { id: "road-highway-casing", type: "line", source: "composite", "source-layer": "road", filter: ["all", ["==", "$type", "LineString"], ["in", "class", "motorway", "trunk"]], paint: { "line-color": "#25241a", "line-width": 6, "line-gap-width": 0 }, layout: { "line-cap": "round" } },
  { id: "admin-boundary", type: "line", source: "composite", "source-layer": "admin", paint: { "line-color": "#333224", "line-width": 1.2, "line-dasharray": [3, 2] } },
  { id: "road-label", type: "symbol", source: "composite", "source-layer": "road", filter: ["in", "class", "motorway", "trunk", "primary", "secondary"], minzoom: 13, layout: { "text-field": "{name}", "text-size": 11, "symbol-placement": "line", "text-max-angle": 30 }, paint: { "text-color": "#5e5c49", "text-halo-color": "#13120A", "text-halo-width": 1.5 } },
  { id: "place-city", type: "symbol", source: "composite", "source-layer": "place_label", filter: ["<=", "symbolrank", 6], layout: { "text-field": "{name}", "text-size": ["step", ["get", "symbolrank"], 18, 4, 15, 6, 13], "text-letter-spacing": 0.05, "text-transform": "none" }, paint: { "text-color": "#c0bda7", "text-halo-color": "#13120A", "text-halo-width": 2 } },
  { id: "place-neighborhood", type: "symbol", source: "composite", "source-layer": "place_label", filter: ["all", [">", "symbolrank", 6], ["<=", "symbolrank", 15]], minzoom: 11, layout: { "text-field": "{name}", "text-size": 11, "text-letter-spacing": 0.08, "text-transform": "uppercase", "text-padding": 8 }, paint: { "text-color": "#5e5c49", "text-halo-color": "#13120A", "text-halo-width": 1.5 } },
  { id: "water-label", type: "symbol", source: "composite", "source-layer": "natural_label", filter: ["<=", "symbolrank", 4], layout: { "text-field": "{name}", "text-size": 11 }, paint: { "text-color": "#464434", "text-halo-color": "#0e0d07", "text-halo-width": 1 } },
];

export function getCustomMapStyle(dark: boolean): mapboxgl.StyleSpecification {
  return {
    version: 8,
    name: dark ? "monochrome-dark" : "monochrome-light",
    sources: {
      composite: {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
      },
    },
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    layers: dark ? DARK_LAYERS : LIGHT_LAYERS,
  };
}
