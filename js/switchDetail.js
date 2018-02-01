module.exports = function(d3, $, cache, topojson, lowres, mapConfig, globals) {
  var urlbase = $("#script_pov12-12-17")[0].src.replace("js/app.js","");
  var fileIndex = globals.fileIndex;
  return function(level, svg, viewBox) {
    var geoList = [];
    var outstandingRequest;
    if (level==="low") {
      var features = topojson.feature(lowres, lowres.objects.districts).features;
      svg.selectAll("path")
        .data(features, function(d) {
          return d.properties[mapConfig.identifier];
        })
        .attr("d", d3.geoPath().projection(d3.geoAlbersUsa()))
        //.attr("fill",globals.calcColorFromData)
        .attr("stroke-width",globals.options.strokeWidths.low)
        .attr("data-detail","low");
        globals.zoomDetail = "low";
        for (outstandingRequest in globals.ajax) {
          if (globals.ajax.hasOwnProperty(outstandingRequest)) {
            globals.ajax[outstandingRequest].abort();
            delete(globals.ajax[outstandingRequest]);
          }
        }
        return;
    }
    svg.selectAll("path").each(function(d) {
      var bbox = this.getBBox();
      var r1 = {
        left: bbox.x,
        top: bbox.y,
        right: bbox.x + bbox.width,
        bottom: bbox.y + bbox.height
      };
      var r2 = {
        left: viewBox[0]*1,
        top: viewBox[1]*1,
        right: viewBox[0]*1 + viewBox[2]*1,
        bottom: viewBox[1]*1 + viewBox[3]*1
      };
      function intersectRect(r1, r2) {
        return !(r2.left > r1.right ||
                 r2.right < r1.left ||
                 r2.top > r1.bottom ||
                 r2.bottom < r1.top);
      }
      var visible = intersectRect(r1, r2);
      if (visible) {
        geoList.push(d.properties[mapConfig.identifier]);
      }
    });

    var fileNames = {};
    for (var i=0, ii = geoList.length; i<ii; i++) {
      var latlonglist = fileIndex[level][geoList[i]];
        for (var j = 0, jj = latlonglist.length; j<jj; j++) {
          var latlong = latlonglist[j];
          if (typeof(latlong)!=="undefined") {
            var file = urlbase + "topo" + level.charAt(0).toUpperCase() + level.slice(1) + "Res/topo_" + latlong[0] + "_" + latlong[1] + "_" + mapConfig.filePattern.replace("$FIPS","all") + ".json";
            fileNames[file] = true;
          }
      }

    }
    var fileList = [];
    for (var name in fileNames) {
      if (fileNames.hasOwnProperty(name)) {
        fileList.push(name);
      }
    }
    var geoRequestHandler = function(d) {
      cache[this.url] = d;
      var req = this;
      var features = topojson.feature(d, d.objects.districts).features;
      var path = d3.geoPath().projection(d3.geoAlbersUsa());
      var color = level==="medium" ? "rgb(" + Math.round(Math.random()*55+200) + ",0,0)" : "rgb(0," + Math.round(Math.random()*55+200)  + ",0)";
      var selection = svg.selectAll("path")
        .data(features, function(d) {
          return d.properties[mapConfig.identifier];
        });
      selection.enter()
        .append("path")
        .attr("d", path);
      selection.attr("d", function(d) {

          if (d3.select(this).attr("data-urlsrc")!==null) {
            if (d3.select(this).attr("data-urlsrc")!==req.url) {
              if (d3.select(this).attr("data-detail")===level) {
                var newpath = path(d);
                var oldpath = d3.select(this).attr("d");
                if (oldpath===null) {
                  oldpath = "";
                }
                if (newpath===null) {
                  newpath="";
                }
                var multipath = oldpath + newpath;
                return multipath;
              }
            }
          }
          return path(d);
        })
        //.attr("fill",level==="medium" ? "#888" : "#333");
        //.attr("fill",color)
        .attr("stroke-width",globals.options.strokeWidths[level]);

      selection.attr("data-urlsrc",this.url);
      selection.attr("data-detail", level);
    };
    for (i = 0, ii = fileList.length; i<ii; i++) {
      if (typeof(cache[fileList[i]])==="undefined") {
        if (typeof(globals.ajax)==="undefined") {
          globals.ajax = {};
        }
        for (outstandingRequest in globals.ajax) {
          if (globals.ajax.hasOwnProperty(outstandingRequest)) {
            if (fileList.indexOf(outstandingRequest)===-1) {
            //  console.log("abort");
              globals.ajax[outstandingRequest].abort();
              delete(globals.ajax[outstandingRequest]);
            }
          }
        }
        if (typeof(globals.ajax[fileList[i]])==="undefined") {
          globals.ajax[fileList[i]] = $.getJSON(fileList[i], geoRequestHandler);
        }
      } else {
        geoRequestHandler.call({url:fileList[i]}, cache[fileList[i]]);
      }
    }
    globals.zoomDetail = level;
  };
};
