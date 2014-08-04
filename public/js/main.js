$(document).ready(function() {
  //var map = L.map('map', { worldCopyJump: true });
  //var basemap = new L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
    //attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
    //});
  //basemap.addTo(map);
  //map.fitWorld();

var width = 800,
    height = 600;

var div = d3.select("#info")
  .append("div")
  .style("opacity", 0);

var zoom = d3.behavior.zoom()
    .scaleExtent([1, 8])
    .on("zoom", zoomed);

var path = d3.geo.path()
    .projection(null);

var svg = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g");

var g = svg.append("g");

svg.append("rect")
  .attr("class", "overlay")
  .attr("width", width)
  .attr("height", height);

svg
  .call(zoom)
  .call(zoom.event);


d3.json("/js/out.json", function( error,p) {

  if (error) return console.error(error);

  var plats = p.objects.props;
  console.log(plats);

  g.selectAll("path")
    .data(topojson.feature(p, plats).features)
    .enter().append("path")
    .attr("data-pin", function(d) { return d.properties.PIN })
    .attr("data-propclass", function(d) { console.log(d.properties.propclass); return d.properties.propclass })
    .attr("data-owner", function(d) { return d.properties.ownername1 })
    .style({'stroke': 'rgba(255,255,255,1)', 'stroke-width': '0.5px' })
    .attr("class", function(d) {return d.properties.classdesc })
    .attr("d", path)
    .on("mouseover", function(d) {
        div.transition().duration(500).style("opacity", 0);
        div.transition().duration(200).style("opacity", .9);
        div.html( "<h3><span class='ion-home'></span>" +  d.properties.propstreetcombined + "</h3>" +
                  "<p><span class='ion-person'></span>" + d.properties.ownername1 + "</p>" +
                  "<p><span class='ion-ios7-pie'></span>" + d.properties.land_netAcres + "&nbsp;Acres</p>" +
                  "<p><span class='ion-calendar'></span>" + d.properties.resb_yearbuilt + "</p>" +
                  "<p>$" + d.properties.adjass_3 + "</p>"
                  )
          .style("left", (d3.event.pageX) + "px")
          .style("top", (d3.event.pageY - 14) + "px");
    })
    .on("mouseout", function(d) {
        div.transition().duration(500).style("opacity", 0);
    });
});

function zoomed() {
  g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

var residential = $('#map').find(".RESIDENTIAL");
console.log(residential);


});
