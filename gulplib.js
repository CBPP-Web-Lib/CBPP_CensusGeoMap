/*globals require, console, Promise, module*/
module.exports = function(gulp, PROJECT_DIR, mapConfig) {
"use strict";
var wget = require("wget-improved"),
unzip = require("unzip"),
topojson = require("topojson"),
merge = require("geojson-merge"),
ogr2ogr = require("ogr2ogr"),
geo_bbox = require("geojson-bbox"),
fs = require("fs");

function makeDirectory(address, cb) {
  fs.mkdir(address, function(e) {
    if (e!==null) {
      if (e.code!=="EEXIST") {
        throw new Error(e);
      }
    }
    cb();
  });
}


gulp.task("geofolder", function(cb) {
  var z = false, e = false;
  makeDirectory(PROJECT_DIR + "/geo_zip",function() {
    z = true;
    if (z&&e) {cb();}
  });
  makeDirectory(PROJECT_DIR + "/geo", function() {
    e = true;
    if (z&&e) {cb();}
  });
});

gulp.task('download_shape', ["geofolder"], function(cb) {
  var fips = require(PROJECT_DIR + "/fips.json");
  var errorHandler = function(err) {
    count--;
    console.log(err);
    if (count<=0) {
      if (typeof(cb)==="function") {
        cb();
      }
    }
  };
  var fileCB = function() {
    count--;
    console.log(count);
    if (count<=0) {
      if (typeof(cb)==="function") {
        cb();
      }
    }
  };
  var count = 0;
  for (var state in fips) {
    if (fips.hasOwnProperty(state)) {
      var c = fips[state].FIPS;
      c+="";
      while (c.length < 2) {
        c = "0" + c;
      }
      var dest = PROJECT_DIR + "/geo_zip/" + mapConfig.filePattern.replace("$FIPS", c) + ".zip";
      if (!fs.existsSync(dest)) {
        count++;
        var req = wget.download(mapConfig.fileSource + mapConfig.filePattern.replace("$FIPS", c) + ".zip", dest);
        req.on("error", errorHandler);
        req.on("end", fileCB);
      }
      if (count===0) {
        fileCB();
        return;
      }
    }
  }
});

gulp.task("unzip_shape", ["download_shape"], function(cb) {
  fs.readdir(PROJECT_DIR + "/geo_zip", function(err, files) {
    var count = 0;
    files.forEach(function(f) {
      count++;
      var nameA = f.split(".");
      if (nameA[nameA.length-1]==="zip") {
        var dest = PROJECT_DIR + "/geo/"+nameA[0];
        if (!fs.existsSync(dest)) {
          fs.createReadStream(PROJECT_DIR + "/geo_zip/" + f).pipe(unzip.Extract(
            {
              path:dest
            }
          ).on("finish", function() {
            count--;
            if (count===0) {
              cb();
            }
          }));
        }
      }
    });
  });
});

gulp.task("geojson_dir", function(cb) {
  makeDirectory(PROJECT_DIR + "/geojson", cb);
});

gulp.task("geojson", ["unzip_shape", "geojson_dir"], function(cb) {
  var count = 0;
  var closeCB = function() {
    count--;
    if (count <= 0) {
      mergeStates();
    }
  };
  function mergeStates() {
    fs.readdir(PROJECT_DIR + "/geojson", function(err, files) {
      var objs = [];
      var count = 0;
      files.forEach(function(file) {
        count++;
        fs.readFile(PROJECT_DIR + "/geojson/" + file, "utf-8", function(err, o) {
          count--;
          objs.push(JSON.parse(o));
          if (count<=0) {
            var merged = merge(objs);
            fs.writeFile(PROJECT_DIR + "/" + mapConfig.filePattern.replace("$FIPS","all") + ".json", JSON.stringify(merged,null," "), cb);
          }
        });
      });
    });
  }
  fs.readdir(PROJECT_DIR + "/geo", function(err, files) {

    var fileIndex = 0;
    function handleFile() {
      var filename = files[fileIndex];
      console.log(filename);
      var puma = ogr2ogr(PROJECT_DIR + '/geo/' + filename + '/' + filename + '.shp')
        .format('GeoJSON')
        .timeout(600000)
        .stream();
      puma.pipe(fs.createWriteStream(PROJECT_DIR + '/geojson/' + filename + '.json')).on("finish", function() {
        fileIndex++;
        if (fileIndex >= files.length) {
          closeCB();
        } else {
          handleFile();
        }
      });
    }
    handleFile();
  });
});

gulp.task("buildDir", function(cb) {
  makeDirectory(PROJECT_DIR + "/build", cb);
});

gulp.task("topoDir", ["buildDir", "intermediate"], function(cb) {
  Promise.all([
    new Promise(function(resolve) {
      makeDirectory(PROJECT_DIR + "/build/topoHighRes", resolve);
    }),
    new Promise(function(resolve) {
      makeDirectory(PROJECT_DIR + "/build/topoMediumRes", resolve);
    }),
    new Promise(function(resolve) {
      makeDirectory(PROJECT_DIR + "/topoLowRes", resolve);
    })
  ]).then(function() {
    if (typeof(cb)==="function") {
      cb();
    }
  });
});

gulp.task("topolowres", ["geojson","topoDir"], function(cb) {
  var filename = mapConfig.filePattern.replace("$FIPS","all");
  console.log(filename);
  var geopuma = require(PROJECT_DIR + "/" + filename + ".json");
  var topopuma = topojson.topology({districts:geopuma});
  topopuma = topojson.quantize(topopuma, 4000);
  topopuma = topojson.presimplify(topopuma);
  topopuma = topojson.simplify(topopuma,0.01);
  console.log(topopuma);
  fs.writeFile(PROJECT_DIR + "/topoLowRes/topo_" + filename + ".json", JSON.stringify(topopuma, null, ' '), function() {cb();});
});

function topoHigherRes(gridSize, folder, quantize, simplify) {
  var filename = mapConfig.filePattern.replace("$FIPS","all");
  var geopuma = require(PROJECT_DIR + "/" + filename + ".json").features;

  var i, ii;
  /*special case for alaska coastline.*/
  if (folder==="High") {
    for (i = 0, ii = geopuma.length; i<ii; i++) {
      /*start here*/
      if (geopuma[i].properties[mapConfig.identifier]*1===200400) {
        //var geoObj = topojson.feature(topopuma, topopuma.objects[i]);
        var topoObj = topojson.topology(geopuma[i]);
        var simplified = topojson.presimplify(topoObj);
        simplified = topojson.simplify(simplified, 0.001);
        var feature = topojson.feature(simplified, simplified.objects.geometry);
        geopuma[i].geometry = feature.geometry;
      }
    }
  }
  var topopuma = topojson.topology(geopuma);
  topopuma = topojson.quantize(topopuma, quantize);
  topopuma = topojson.presimplify(topopuma);
  topopuma = topojson.simplify(topopuma,simplify);

  var index = {};
  var range;
  var id;
  var bbox;
  for (var outerIndex = 0, geoLength=geopuma.length; outerIndex<geoLength; outerIndex++) {
    id = geopuma[outerIndex].properties[mapConfig.identifier];
    bbox = geo_bbox(geopuma[outerIndex]);
    if (typeof(range)==="undefined") {
      range = JSON.parse(JSON.stringify(bbox));
    }
    range[0] = Math.min(range[0], bbox[0]);
    range[1] = Math.min(range[1], bbox[1]);
    range[2] = Math.max(range[2], bbox[2]);
    range[3] = Math.max(range[3], bbox[3]);
    index[id] = [bbox, outerIndex];
  }
  var x, y, obj;
  var tiles = {};
  var filterFunction = function(x, y) {
    x*=1;
    y*=1;
    return function(arcs) {
      var minx, miny;
      function recurse(a) {
        if (typeof(a[0])==="object") {
          recurse(a[0]);
        } else {
          for (var j = 0, jj = a.length; j<jj;j++) {
            var arcNumber = a[j];
            if (arcNumber < 0) {
              arcNumber = Math.abs(arcNumber)-1;
            }
            obj = topopuma.arcs[arcNumber];
            for (var i = 0, ii = obj.length; i<ii; i++) {
              if (typeof(minx)==="undefined") {
                minx = obj[i][0];
              }
              if (typeof(miny)==="undefined") {
                miny = obj[i][1];
              }
              minx = Math.min(obj[i][0], minx);
              miny = Math.min(obj[i][1], miny);
            }
          }
        }
      }
      recurse(arcs);
      if (minx >= x && minx < (x+gridSize) && miny >= y && miny < (y + gridSize)) {
        return true;
      }
      return false;
    };
  };

  for (x = Math.floor(range[0]/gridSize)*gridSize; x<=Math.ceil(range[2]/gridSize)*gridSize; x+=gridSize) {
    console.log(x);
    for (y = Math.floor(range[1]/gridSize)*gridSize; y<=Math.ceil(range[3]/gridSize)*gridSize; y+=gridSize) {
      ii = 0;
      gridTopoJson = {};
      var gridTopoJson = topojson.filter(topopuma, filterFunction(x,y));
      var newObjects = {"districts":{"type":"GeometryCollection","geometries":[]}};
      var newIndex = 0;
      for (var oldIndex in gridTopoJson.objects) {
        if (gridTopoJson.objects.hasOwnProperty(oldIndex)) {
          if (gridTopoJson.objects[oldIndex].type!==null) {
            newObjects.districts.geometries[newIndex] = gridTopoJson.objects[oldIndex];
            newIndex++;
          } else {


          }
        }
      }
      gridTopoJson.objects = newObjects;
      for (i = 0, ii = newObjects.districts.geometries.length; i<ii; i++) {
        if (typeof(tiles[newObjects.districts.geometries[i].properties[mapConfig.identifier]])==="undefined") {
          tiles[newObjects.districts.geometries[i].properties[mapConfig.identifier]] = [];
        }
        tiles[newObjects.districts.geometries[i].properties[mapConfig.identifier]].push([x,y]);
      }
      if (ii>0) {
        var fullFilename = "topo_" + x + "_" + y + "_" + filename + ".json";
        fs.writeFileSync(PROJECT_DIR + "/build/topo" +folder + "Res/" +fullFilename, JSON.stringify(gridTopoJson), function() {});
      }
    }


  }
  fs.writeFile(PROJECT_DIR + "/intermediate/" + folder.toLowerCase() + "Index.json", JSON.stringify(tiles), function() {});
}

gulp.task("topo", ["topolowres","topomediumres","topohighres"]);

gulp.task("topomediumres", ["geojson","topoDir"], function() {
  topoHigherRes(mapConfig.medium.gridSize, "Medium", 20000, 0.001);
  gulp.watch([]);
});

gulp.task("topohighres", ["geojson", "topoDir"], function() {
  topoHigherRes(mapConfig.high.gridSize, "High", 500000, 0.00001);
});


};
