module.exports = function($, d3, cache, topojson, lowres, mapConfig, globals) {
  var switchDetail = require("./switchDetail.js")(d3, $, cache, topojson, lowres, mapConfig, globals);
  var mouseDown = false;
  var mouseBase = {};
  var baseViewBox = [];
  function getMovementAndViewBoxFromEvent(e, scaling) {
    var movement = {
      x: e.pageX - mouseBase.x,
      y: e.pageY - mouseBase.y
    };
    var newViewBox = [
      baseViewBox[0]*1 - movement.x*scaling,
      baseViewBox[1]*1 - movement.y*scaling,
      baseViewBox[2]*1,
      baseViewBox[3]*1
    ].join(" ");
    return {
      movement: movement,
      newViewBox: newViewBox
    };
  }
  return function(svg) {
    var scaling;
    svg.on("mousedown", function() {
      mouseDown = true;
      mouseBase = {
        x: d3.event.pageX,
        y: d3.event.pageY
      };
      baseViewBox = svg.attr("viewBox").split(" ");
      scaling = baseViewBox[2]/$(svg.node()).width();
    });
    svg.on("mouseup mouseleave", function() {
      var target = d3.event.relatedTarget;
      if ($(target).hasClass("popup") || $(target).parents(".popup").length>0) {
        return;
      }
      mouseDown = false;
      var eData = getMovementAndViewBoxFromEvent(d3.event, scaling);
      switchDetail(globals.zoomDetail, svg, eData.newViewBox.split(" "));

    });
    svg.on("mousemove", function() {
      if (mouseDown) {
        var eData = getMovementAndViewBoxFromEvent(d3.event, scaling);
        svg.attr("viewBox", eData.newViewBox);
        /*if (eData.movement.x%10 === 0 || eData.movement.y%10===0) {
          switchDetail(globals.zoomDetail, svg, eData.newViewBox.split(" "));
        }*/
      }
    });
  };
};
