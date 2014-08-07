$(document).ready(function() {

  var socket = io();

  socket.on('greet', function (data) {
    console.log(data);
  });

  socket.on('pin', function(data) {

    var p = document.querySelector('#saleshistory');
    var tableRef = document.getElementById('saledata').getElementsByTagName('tbody')[0];
    var tbody = document.getElementById('tbody');
    tableRef.innerHTML = '';

    for (i=0; i < data.length; i++) {

      var sale = {
        date: data[i].DateOfSale,
        seller: data[i].grantor,
        buyer: data[i].grantee,
        price: data[i].saleprice,
        terms: data[i].terms
      }
      var newRow   = tableRef.insertRow(0);
      newRow.innerHTML = '<td>' + moment(sale.date).fromNow() + '</td>' + '<td>' + numeral(sale.price).format('$0,0[.]00') + '</td>' + '<td>' + sale.buyer + '</td><td>' + sale.seller + '</td><td>' + sale.terms + '</td>';
    }
    p.innerHTML = '<p>This property has&nbsp;<span style="color: #01FF70">' + data.length + '</span>&nbsp;public records in the sales database.</p>';
  });

  var map = L.map('map', {center: [44.7631, -85.6206], zoom: 14})
  .addLayer(new L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
    }));

  var div = d3.select(".offer-content")
    .insert("div", ":first-child")
    .attr("class", "info")
    .style("opacity", 0);

  var legend = d3.select("#legend li");

  var table = d3.select("#saledata")
    .style("opacity", 0);

  var intro = d3.select("#intro")
    .style("opacity", 1);


  var svg = d3.select(map.getPanes().overlayPane).append("svg"),
    g = svg.append("g").attr("class", "leaflet-zoom-hide");

  d3.json("/js/tcgeo.json", function(collection) {
    var transform = d3.geo.transform({point: projectPoint}),
        path = d3.geo.path().projection(transform);

    var feature = g.selectAll("path")
        .data(collection.features)
      .enter().append("path")
        .attr("data-pin", function(d) { return d.properties.PIN })
        .attr("data-propclass", function(d) { return d.properties.propclass })
        .attr("data-owner", function(d) { return d.properties.ownername1 })
        .style({'stroke': 'rgba(255,255,255,1)', 'stroke-width': '0.5px' })
        .attr("class", function(d) {return d.properties.classdesc })
        .attr("d", path)
        .on("click", function(d) {
          var pin = d.properties.PIN;
          socket.emit('getpin', pin);
          var data = {
            street: d.properties.propstreetcombined,
            owner: d.properties.ownername1,
            area: d.properties.land_netAcres,
            zone: d.properties.propclass
          };

         if (d.properties.propclass == '201') {
           data.year = d.properties.cib_yearbuilt;
         } else if (d.properties.propclass == '401') {
           data.year = d.properties.resb_yearbuilt;
         } else if (d.properties.propclass == '401') {
           data.year = "NA";
         }

        //  console.log(data);
            div.transition().duration(500).style("opacity", 0);
            div.transition().duration(200).style("opacity", .9);
            intro.transition().duration(100).style("opacity", 0).style("height", 0);
            table.transition().duration(200).style("opacity", .9);
            div.html( "<h3 class='lead'>" +  d.properties.propstreetcombined + "</h3>" +
                      "<p>Owner: " + d.properties.ownername1 + "</p>" +
                      "<p>Assessed Value: " + numeral(d.properties.adjass_3).format('$0,0[.]00') + "</p>" +
                      "<p>Year Built: " + data.year + "</p>" +
                      "<p>Lot Area: " + d.properties.land_netAcres + "&nbsp;Acres</p>"
                      );
        });


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
