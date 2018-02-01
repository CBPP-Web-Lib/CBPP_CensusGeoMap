module.exports = function($, d3, cache, topojson, lowres, mapConfig, globals) {
  globals.zoomDetail = "low";
  var switchDetail = require("./switchDetail.js")(d3, $, cache, topojson, lowres, mapConfig, globals);
  return function(zoomAmount, svg, coords) {
    zoomAmount = Math.max(0.75, zoomAmount);
    zoomAmount = Math.min(1.25, zoomAmount);
    var viewBox = svg.attr("viewBox").split(" ");
    for (var i = 0, ii = viewBox.length; i<ii; i++) {
      viewBox[i]*=1;
    }
    coords.x = (coords.x/$(svg.node()).width()) * viewBox[2] + viewBox[0];
    coords.y = (coords.y/$(svg.node()).height()) * viewBox[3] + viewBox[1];
    var newViewBox = [];
    newViewBox[2] = viewBox[2]*zoomAmount;
    newViewBox[3] = viewBox[3]*zoomAmount;
    newViewBox[0] = coords.x - newViewBox[2]*((coords.x - viewBox[0])/viewBox[2]);
    newViewBox[1] = coords.y - newViewBox[3]*((coords.y - viewBox[1])/viewBox[3]);
    svg.attr("viewBox", newViewBox.join(" "));
    checkDetail(newViewBox, svg);
  };

  function checkDetail(viewBox, svg) {
    if (viewBox[2]>=400 && globals.zoomDetail!=="low") {
      switchDetail("low", svg, viewBox);
    }
    if (viewBox[2]<400 && viewBox[2] >= 100 && globals.zoomDetail!=="medium") {
      switchDetail("medium", svg, viewBox);
    }
    if (viewBox[2]<100 && globals.zoomDetail!=="high") {
      switchDetail("high", svg, viewBox);
    }
  }


};
