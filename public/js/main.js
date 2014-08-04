$(document).ready(function() {
  var map = L.map('map', {center: [37.8, -96.9], zoom: 4})
  .addLayer(new L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
    }));

  var svg = d3.select(map.getPanes().overlayPane).append("svg"),
    g = svg.append("g").attr("class", "leaflet-zoom-hide");

  d3.json("/js/tcgeo.json", function(collection) {
    console.log(collection);
    var transform = d3.geo.transform({point: projectPoint}),
        path = d3.geo.path().projection(transform);

    var feature = g.selectAll("path")
        .data(collection.features)
      .enter().append("path");

    map.on("viewreset", reset);
    reset();

    // Reposition the SVG to cover the features.
    function reset() {
      var bounds = path.bounds(collection),
          topLeft = bounds[0],
          bottomRight = bounds[1];

      svg .attr("width", bottomRight[0] - topLeft[0])
          .attr("height", bottomRight[1] - topLeft[1])
          .style("left", topLeft[0] + "px")
          .style("top", topLeft[1] + "px");

      g   .attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

      feature.attr("d", path);
    }

    // Use Leaflet to implement a D3 geometric transformation.
    function projectPoint(x, y) {
      var point = map.latLngToLayerPoint(new L.LatLng(y, x));
      this.stream.point(point.x, point.y);
    }
  });


});
