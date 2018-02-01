/*globals module, require, console*/
module.exports = function($, d3, mapConfig, urlbase, shapes, fileIndex) {
"use strict";
var topojson = require("topojson");
var projection = d3.geoPath().projection(d3.geoAlbersUsa());
require("./polyfills.js");
require("./css/puma.css");
var hexRgb = require("hex-rgb");
var rgbHex = require("rgb2hex");
var cache = {};
var main = function(sel) {
  var svg;
  $(sel).addClass("cbppCensusMap");
  var defaults = {
    /*default map config here*/
    colors : {
      nodata: "#aaaaaa",
      hover: "#EB9123"
    },
    dataIndex: 0,
    strokeWidths: {
      low: 0.5,
      medium: 0.1,
      high: 0.02
    },
    popupTemplate: function(d) {
      return JSON.stringify(d);
    },
    popupWidth:"300px"
  };
  this.options = {};
  this.sel = sel;
  this.fileIndex = fileIndex;
  var map = this;
  $.extend(true, this.options, defaults);
  var zoom = require("./js/zoom.js")($, d3, cache, topojson, shapes, mapConfig, this);
  var drag = require("./js/drag.js")($, d3, cache, topojson, shapes, mapConfig, this);
  this.setupSVG = function() {
    $(sel).empty();
    svg = d3.select(sel).append("svg");
    svg.attr("viewBox","50 0 840 500");
    svg.on("wheel.zoom", function() {
      d3.event.preventDefault();
      var zoomAmount = 1+(d3.event.deltaY/100);
      var coords = {
        x: d3.event.pageX - $(sel).offset().left,
        y: d3.event.pageY - $(sel).offset().top
      };
      zoom(zoomAmount, svg, coords);
    });
    drag(svg);
  };
  function calculateMinMax(data, index) {
    var min, max;
    for (var i in data) {
      if (data.hasOwnProperty(i)) {
        if (typeof(data[i][index])==="undefined") {
          return undefined;
        }
        if (typeof(min)==="undefined") {
          min = data[i][index];
        }
        if (typeof(max)==="undefined") {
          max = data[i][index];
        }
        min = Math.min(min, data[i][index]);
        max = Math.max(max, data[i][index]);
      }
    }
    return {
      min: min,
      max: max
    };
  }
  var recalcRange = function() {
    if (typeof(map.options.range)==="undefined") {
      map.options.range = {};
    }
    var override = {};
    var needCalc = false;
    if (typeof(map.options.rangeOverride)!=="undefined") {
      if (typeof(map.options.rangeOverride.max)!=="undefined") {
        override.max = map.options.rangeOverride.max;
      } else {
        needCalc = true;
      }
      if (typeof(map.options.rangeOverride.min)!=="undefined") {
        override.min = map.options.rangeOverride.min;
      } else {
        needCalc = true;
      }
    } else {
      needCalc = true;
    }
    if (needCalc) {
      map.options.range = calculateMinMax(map.options.data, map.options.dataIndex);
    }
    $.extend(true, map.options.range, override);
  };
  this.setOptions = function(options) {
    $.extend(true, this.options, options);
    if (typeof(this.options.data)!=="undefined") {
      recalcRange();
    }
  };

  this.calcColorFromData = function(d) {
    function interpolateRGB(d, top, bottom) {
      var r = [];
      for (var i = 0; i<3; i++) {
        r[i] = Math.round(d*(top[i] - bottom[i]) + bottom[i]);
      }
      return r;
    }
    var id = d.properties[mapConfig.identifier]*1;
    if (typeof(map.options.data[id])==="undefined") {
      return map.options.colors.nodata;
    }
    var ind = map.options.dataIndex;
    var data = (map.options.data[id][ind]-map.options.range.min)/(map.options.range.max - map.options.range.min);
    var rgbTop = hexRgb(map.options.colors.high);
    var rgbBottom = hexRgb(map.options.colors.low);
    var rgbThis = interpolateRGB(data, rgbTop, rgbBottom);
    rgbThis = "rgb("+rgbThis[0]+","+rgbThis[1]+","+rgbThis[2]+")";
    var color = rgbHex(rgbThis).hex;
    return color;
  };
  this.makePopup = function(d) {
    var popupAnchor = $(sel + " .popupAnchor");
    if (popupAnchor.length===0) {
      popupAnchor = $(document.createElement("div")).addClass("popupAnchor");
      $(sel).append(popupAnchor);
    }
    popupAnchor.removeClass("upper");
    popupAnchor.removeClass("lower");
    if (d3.event.pageY - $(sel).offset().top > $(sel).height()/2) {
      popupAnchor.addClass("lower");
    } else {
      popupAnchor.addClass("upper");
    }
    var popupWrap = $(sel + " .popupAnchor .popupWrap");
    if (popupWrap.length===0) {
      popupWrap = $(document.createElement("div")).addClass("popupWrap");
      popupAnchor.append(popupWrap);
    }
    var popupActual = $(sel + " .popupAnchor .popupWrap .popup");
    if (popupActual.length===0) {
      popupActual = $(document.createElement("div")).addClass("popup");
      popupWrap.append(popupActual);
      popupActual.css("width", map.options.popupWidth);
    }
    popupActual.html(map.options.popupTemplate(d));
    var leftPx = d3.event.pageX - $(sel).offset().left;
    var popupLeft = leftPx - popupActual.width()*leftPx/$(sel).width();
    popupAnchor.css("left", popupLeft + "px")
      .css("top", (d3.event.pageY - $(sel).offset().top) + "px");

  };
  this.deletePopup = function(d) {
    $(sel + " .popupWrap").remove();
  };
  this.initialShapes = function() {
    var features = topojson.feature(shapes, shapes.objects.districts).features;
    var path = projection;
    svg.selectAll("path")
      .data(features, function(d) {
        return d.properties[mapConfig.identifier];
      })
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill",map.calcColorFromData)
      .attr("stroke","#000")
      .attr(mapConfig.identifier, function(d) {
        return d.properties[mapConfig.identifier];
      })
      .attr("stroke-width",map.options.strokeWidths.low)
      .on("mousemove mouseenter", function(d) {
        map.makePopup(d);
        d3.select(this).attr("fill",map.options.colors.hover);
      })
      .on("mouseout", function(d) {
        d3.select(this).attr("fill",map.calcColorFromData(d));
        map.deletePopup();
      });
  };
};


return main;
};
