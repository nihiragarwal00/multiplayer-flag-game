import React, { useEffect, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import * as topojson from "topojson-client";
import { geoBounds } from "d3-geo";

const geoUrl =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Common country name mappings
const countryNameMap = {
  "United States": "United States of America",
  "Czech Republic": "Czechia",
  "United Kingdom": "United Kingdom of Great Britain and Northern Ireland",
  "Russia": "Russian Federation",
  "Iran": "Iran (Islamic Republic of)",
  "Syria": "Syrian Arab Republic",
  "Venezuela": "Venezuela (Bolivarian Republic of)",
  "Tanzania": "United Republic of Tanzania",
  "Laos": "Lao People's Democratic Republic",
  "Brunei": "Brunei Darussalam",
  "Congo": "Republic of the Congo",
  "DR Congo": "Democratic Republic of the Congo",
  "East Timor": "Timor-Leste",
  "Swaziland": "Eswatini",
  "Cape Verde": "Cabo Verde",
  "Macedonia": "North Macedonia",
  "Palestine": "State of Palestine",
  "Vietnam": "Viet Nam",
  "Moldova": "Republic of Moldova",
  "Korea": "Republic of Korea",
  "North Korea": "Democratic People's Republic of Korea",
  "Myanmar": "Burma",
  "Côte d'Ivoire": "Ivory Coast",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "Dominican Republic": "Dominican Rep.",
  "Central African Republic": "Central African Rep.",
  "Equatorial Guinea": "Eq. Guinea",
  "Solomon Islands": "Solomon Is.",
  "Marshall Islands": "Marshall Is.",
  "United Arab Emirates": "U.A.E.",
  "São Tomé and Príncipe": "São Tomé and Principe",
  "Antigua and Barbuda": "Antigua and Barb.",
  "Saint Vincent and the Grenadines": "St. Vin. and Gren.",
  "Saint Kitts and Nevis": "St. Kitts and Nevis",
  "Saint Lucia": "Saint Lucia",
  "Trinidad and Tobago": "Trinidad and Tobago",
  "Papua New Guinea": "Papua N.G.",
  "Federated States of Micronesia": "Micronesia",
  "Republic of the Congo": "Congo",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "South Sudan": "S. Sudan",
  "The Bahamas": "Bahamas",
  "The Gambia": "Gambia",
  "Comoros": "Comoros",
  "Seychelles": "Seychelles",
  "Mauritius": "Mauritius",
  "Cabo Verde": "Cape Verde",
  "Eswatini": "Swaziland",
  "Timor-Leste": "East Timor",
  "North Macedonia": "Macedonia",
  "State of Palestine": "Palestine",
  "Viet Nam": "Vietnam",
  "Republic of Moldova": "Moldova",
  "Republic of Korea": "Korea",
  "Democratic People's Republic of Korea": "North Korea",
  "Lao People's Democratic Republic": "Laos",
  "Brunei Darussalam": "Brunei",
  "United Republic of Tanzania": "Tanzania",
  "Venezuela (Bolivarian Republic of)": "Venezuela",
  "Syrian Arab Republic": "Syria",
  "Iran (Islamic Republic of)": "Iran",
  "Russian Federation": "Russia",
  "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
  "Czechia": "Czech Republic",
  "United States of America": "United States"
};

const MapChart = ({ highlightedCountry }) => {
  const [geographies, setGeographies] = useState([]);
  const [center, setCenter] = useState([0, 20]);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [countryFound, setCountryFound] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    fetch(geoUrl)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch map data');
        return res.json();
      })
      .then(data => {
        const geoFeatures = topojson.feature(data, data.objects.countries).features;
        setGeographies(geoFeatures);
      })
      .catch(err => {
        setError(err.message);
        console.error('Error loading map data:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (highlightedCountry && geographies.length) {
      // Try to find the country using the mapping first
      const mappedName = countryNameMap[highlightedCountry] || highlightedCountry;
      
      const country = geographies.find(
        geo => {
          const geoName = geo.properties.name.toLowerCase();
          const searchName = mappedName.toLowerCase();
          return geoName === searchName;
        }
      );
      
      if (country) {
        setCountryFound(true);
        // Get the centroid from the geometry using d3-geo
        const bounds = geoBounds(country);
        const [x, y] = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
        
        // Smooth transition to the new center and zoom
        setCenter([x, y]);
        setZoom(3.5);
      } else {
        console.warn(`Could not find country on map: ${highlightedCountry}`);
        setCountryFound(false);
        // Smooth transition back to default view
        setCenter([0, 20]);
        setZoom(1);
      }
    }
  }, [highlightedCountry, geographies]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg shadow-inner">
        <div className="text-gray-600 text-lg">Loading map...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50 rounded-lg shadow-inner">
        <div className="text-red-600 text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!countryFound) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg shadow-inner">
        <div className="text-gray-600 text-lg">Map not available for this country</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-white rounded-lg shadow-lg overflow-hidden">
      <ComposableMap 
        projectionConfig={{ 
          scale: 160,
          center: [0, 20]
        }}
        className="w-full h-full"
      >
        <ZoomableGroup 
          center={center} 
          zoom={zoom}
          minZoom={1}
          maxZoom={8}
          translateExtent={[[-180, -90], [180, 90]]}
          onMoveStart={() => setIsDragging(true)}
          onMoveEnd={({ coordinates, zoom }) => {
            setCenter(coordinates);
            setZoom(zoom);
            setIsDragging(false);
          }}
        >
          <Geographies geography={geographies}>
            {({ geographies }) =>
              geographies.map(geo => {
                const mappedName = countryNameMap[highlightedCountry] || highlightedCountry;
                const isHighlighted = geo.properties.name.toLowerCase() === mappedName?.toLowerCase();
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isHighlighted ? "#FF5722" : "#D6D6DA"}
                    stroke="#FFF"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        outline: "none",
                        transition: "all 250ms",
                      },
                      hover: {
                        fill: isHighlighted ? "#FF5722" : "#F53",
                        outline: "none",
                        cursor: isDragging ? "grabbing" : "pointer",
                      },
                      pressed: {
                        outline: "none",
                        cursor: "grabbing",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};

export default MapChart;
