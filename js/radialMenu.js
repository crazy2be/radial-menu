// kate: indent-width: 2;
;(function (window) {
  "use strict";

  /** creating optins object */
  function extend(a, b) {
    var c = {};
    for (var key in a) {
      if (b && b.hasOwnProperty(key)) c[key] = b[key];
      else c[key] = a[key];
    }
    return c;
  };

  /** checking if circles have size parameter */
  function checkSize(arr) {
    var total_size = arr.map(el => el.options.size).filter(s => s).reduce((t, s) => t + s, 0);
    // I think that > 1 means we set it in code?
    if ((total_size > 1) || (total_size === 0)) return false;
    else return total_size.toFixed(2);
  }
  
  var deg2rad = (deg) => (deg / 180.) * Math.PI;

  /** circlePoints: step, big radius, small radius, center point x/y, spacing between items */
  function circlePoints(step, r1, r2, cx, cy, spacing) {
    var points = [];
    var circleLengthBig   = 2*Math.PI*r1;
    var circleLengthSmall = 2*Math.PI*r2;

    for (var i = 0; i <= 360; i += Number(step.toFixed(1))) {
      var spaceDeg = (spacing/2) * 360;
      var beforeSmall = deg2rad(i - spaceDeg/circleLengthBig);
      var beforeBig   = deg2rad(i - spaceDeg/circleLengthSmall);
      var afterSmall  = deg2rad(i + spaceDeg/circleLengthBig);
      var afterBig    = deg2rad(i + spaceDeg/circleLengthSmall);
      points.push({
        before: {
          big: {
            x: Math.round(cx + r1 * Math.cos(beforeSmall)),
            y: Math.round(cy + r1 * Math.sin(beforeSmall)),
          },
          small: {
            x: Math.round(cx + r2 * Math.cos(beforeBig)),
            y: Math.round(cy + r2 * Math.sin(beforeBig)),
          }
        },
        after: {
          big: {
            x: Math.round(cx + r1 * Math.cos(afterSmall)),
            y: Math.round(cy + r1 * Math.sin(afterSmall)),
          },
          small: {
            x: Math.round(cx + r2 * Math.cos(afterBig)),
            y: Math.round(cy + r2 * Math.sin(afterBig)),
          }
        }
      });
    }
    return points;
  };

  /** radialMenu constructor */
  var radialMenu = function (options) {
    this.defaults = {
      "stroke-width": 1, //stroke width around every menu item, in pixels
      "spacing": 10, //amount of space between menu items
      "opacity": 1, //opacity of the main menu
      "size": null, //if set to a float value 0-1, attempt to allow the section to take that percent of the circle. if null, size is automatically calculated by
      "font-size": 14, //font size of this item, in pixels
      "font-family": 'Verdana',
      "font-color": '#000000',
      "active-font-color": '#000000',
      "active-stroke": '#000000',
      "active-stroke-opacity": 1.0,
      "active-fill": '#FFFFFF',
      "active-fill-opacity": 1.0,
      "stroke": '#000000',
      "stroke-opacity": 1.0,
      "fill": '#FFFFFF',
      "fill-opacity": 0.5,
      "data": null, //optionally additional object can be provided that will be sent to the callback, this could include an ID or URL to load on click
      "onclick": null, //callback, none by default
      "circles-spacing": 0,
      "start-radius": 50
    };
    this.options = extend(this.defaults, options);
    this.parentOptions = this.options;

    if (self.Snap) {
      this.init();
    } else {
      console.log("Snap.svg library is required");
    }
  };

  radialMenu.prototype = {
    init: function () {
      var self = this;

      // add svg to body
      this.body = document.querySelector("body");
      this.xmlns = "http://www.w3.org/2000/svg";
      this.svg = document.createElementNS (this.xmlns, "svg");

      // radialMenu SVG elements
      this.s = Snap(this.svg);
      this.g;
      this.mainGroup = this.s.group();
      this.mainGroup.addClass("radialMenu-holder");

      // radiuses
      this.radiusBig;
      this.radiusSmall = this.options["start-radius"];

      // empty arrays too keep radial item objects
      this.childs = [];
      this.circles = [];
      this.texts = [];

      // if opened
      this.isOpened = false;
    },

    /** finding new radiuses. Default - +50px */
    calculateRadiuses: function () {
      this.radiusSmall = this.parent ? this.parent.radiusBig + 10 : this.radiusSmall;
      this.radiusBig = this.radiusSmall + 50;

      var circleLength = 2*Math.PI*this.radiusBig;

      var text = this.childs.reduce((text, el) => text + el.label, "");
      var textLength = this.s.text(0, 0, text);
      textLength.toDefs();
      if (circleLength < textLength.node.clientWidth) {
        var textRadius = textLength.node.clientWidth / (2*Math.PI);
        this.radiusBig = textRadius + (textRadius-this.radiusSmall) + 10;
      }
    },

    /** get menu holder */
    get: function () {
      return this.mainGroup;
    },

    /** open method for each object */
    open: function () {
      if (this.isOpened) return;

      var self = this;
      if (!this.parent) {
        this.buildSvg();
        this.buildChildren();
      } else {
        this.parent.closeAllChildren();
        this.parent.open();
        this.buildChildren();
        this.parent.removeActive();
        this.parent.addActive(this.parent.childs.indexOf(this));
      }
    },

    /** creating SVG element and paste it to body */
    buildSvg: function () {
      this.svg.setAttribute("style", "position: absolute; left:50%; top:50%; margin:0;");
      this.mainGroup.attr("opacity", this.options.opacity);
      // this.mainGroup.transform("0");
      this.body.insertBefore(this.svg, this.body.firstChild);
    },

    /** all drawing magic is here */
    buildChildren: function () {
      var self = this;

      var step = 360/this.childs.length;
      // add flag means menu is opened
      this.isOpened = true;
      // Calculating radiuses before children builds
      this.calculateRadiuses();
      // building points for drawing
      var points = circlePoints(step, this.radiusBig, this.radiusSmall, 0, 0, this.options.spacing);
      var childs_length = Object.keys(points).length;
      this.g = this.mainGroup.group();

      for (var i = 0; i < childs_length - 1; i++) {
        (function (i) {
          // TODO: This rotation logic is not quite right. It looks like it was wrong to begin with.
          // Basically the goal here is to change the diameter of the cicrle drawn when there are
          // only two segments, because otherwise you end up with a visibly distorted "egg" shape.
          var rotated = (points[i].after.big.x === points[i+1].before.big.x) && !(points[i].after.big.y === points[i+1].before.big.y);
          var adjx = (rotated && self.childs[i].options.size == 0.5) ? self.options.spacing / 2 : 0.;
          var adjy = (!rotated && self.childs[i].options.size == 0.5) ? self.options.spacing / 2 : 0.;
          self.circles.push(self.g.path(
             "M " + points[i].after.big.x + " " + points[i].after.big.y +
            " A " + (self.radiusBig-adjx) + " " + (self.radiusBig-adjy) + " 0, 0, 1 " +
                    points[i+1].before.big.x + " " + points[i+1].before.big.y +
            " L " + points[i+1].before.small.x + " " + points[i+1].before.small.y +
            " A " + (self.radiusSmall-adjx) + " " + (self.radiusSmall-adjy) + " 0, 0, 0 " +
                    points[i].after.small.x + " " + points[i].after.small.y + " Z")
          .attr({
            "stroke-width": self.options["stroke-width"],
            "stroke": self.childs[i].options["stroke"],
            "stroke-opacity": self.childs[i].options["stroke-opacity"],
            "fill": self.childs[i].options["fill"],
            "fill-opacity": self.childs[i].options["fill-opacity"],
            "cursor": "pointer"
          })
          .click(function () {
            if (self.childs[i].options.onclick) {
              self.childs[i].options.onclick();
            }
            if (!self.childs[i].isOpened) {
              self.childs[i].open(i);
            }
          }));

          var radiusMid = (self.radiusBig + self.radiusSmall) / 2;
          var mid = (a) => (a.big.x + a.small.x)/2  +  " "  +  (a.big.y + a.small.y)/2
          var afterMid = mid(points[i].after);
          var beforeMid = mid(points[i+1].before);
          var sweep = ~~(points[i].after.big.x <= points[i+1].before.big.x);
          if (sweep) [afterMid, beforeMid] = [beforeMid, afterMid];
          self.texts.push(self.g.text(0, 0, self.childs[i].label).attr({
            "textpath": "M " + beforeMid + " A " + radiusMid + " " + radiusMid + " 0, 0, " + sweep + " " + afterMid
          }));
          self.texts[i].attr({
            "fill": self.childs[i].options["font-color"],
            "font-family": self.childs[i].options["font-family"],
            "font-size": self.childs[i].options["font-size"],
            "text-anchor": "middle",
            "pointer-events": "none",
            "alignment-baseline": "baseline"
          });
          self.texts[i].textPath.attr({
            "startOffset": "50%",
            "alignment-baseline": "middle"
          });
        })(i);
      }
      this.addAnimationIn();
    },

    /** close current item */
    closeChildren: function () {
      if (!this.isOpened) return;
      if (this.g) this.addAnimationOut();
    },

    /** close childs of every item */
    closeAllChildren: function () {
      this.childs.forEach(el => el.closeChildren());
    },

    /** closing each circle */
    close: function () {
      var self = this;
      if (!this.parent) {
        var length = this.mainGroup.selectAll("g").length;
        setTimeout(function () {
          self.clearWholeMenu();
        }, length*60);
      }

      if (this.g && !this.g.removed) {
        this.g.remove();
        this.circles = [];
        this.texts = [];
        this.isOpened = false;
        this.closeAllChildren();
      }
    },

    /** remove all snapSVG elements after all circles was removed */
    clearWholeMenu: function () {
      this.g.remove();
      this.circles = [];
      this.texts = [];
      this.isOpened = false;
      this.s.remove();
    },

    /** remove active  */
    removeActive: function () {
      var self = this;

      this.circles.forEach(function (el, index) {
        el.attr({
          "stroke": self.childs[index].options["stroke"],
          "stroke-opacity": self.childs[index].options["stroke-opacity"],
          "fill": self.childs[index].options["fill"],
          "fill-opacity": self.childs[index].options["fill-opacity"]
        });
      });

      this.texts.forEach(function (el, index) {
        el.attr({
          "fill": self.childs[index].options["font-color"]
        });
      });
    },

    /** add active styles */
    addActive: function (index) {
      this.circles[index].attr({
        "stroke": this.childs[index].options["active-stroke"],
        "stroke-opacity": this.childs[index].options["active-stroke-opacity"],
        "fill": this.childs[index].options["active-fill"],
        "fill-opacity": this.childs[index].options["active-fill-opacity"]
      });

      this.texts[index].attr({
        "fill": this.childs[index].options["active-font-color"]
      });
    },

    /** animating each circle in */
    addAnimationIn: function () {
      if (!this.childs.length) return;

      var group = this.g;
      var bbox = group.getBBox();
      var width = bbox.width;
      var height = bbox.height;
      var x = bbox.x;
      var y = bbox.y;
      var cx = bbox.cx;
      var cy = bbox.cy;
      var cw = parseInt(this.svg.getAttribute('width')) || 0;
      var ch = parseInt(this.svg.getAttribute('height')) || 0;

      if(cw < width && ch < height){
        this.svg.setAttributeNS (null, "width", width+"px");
        this.svg.setAttributeNS (null, "data-left", this.svg.style.left);
        this.svg.style.marginLeft =  (-width / 2)+'px';

        this.svg.setAttributeNS (null, "height", height+"px");
        this.svg.setAttributeNS (null, "data-top", this.svg.style.top);
        this.svg.style.marginTop =  (-height / 2)+'px';

        this.mainGroup.transform('t'+width/2+','+height/2);
      }

      this.g
        .attr({
          opacity: 0
        })
        .transform("r0," + x + ',' + y + "s0.5, 0.5," + cx + "," + cy);

      this.g.animate({
        transform: "r0," + x + ',' + y + "s1,1," + cx + "," + cy,
        opacity: 1
      } , 300, mina.easeout);
    },

    /** animating each circle out. Callback - close next level circle */
    addAnimationOut: function () {
      var self = this;

      this.g.animate({
        transform: "r0," + this.g.getBBox().x + ',' + this.g.getBBox().y + "s0.8, 0.8," + this.g.getBBox().cx + "," + this.g.getBBox().cy,
        opacity: 0
      } , 60, mina.easeout, function () {
        self.close();
      });
    },

    /** method to add children */
    add: function (label, options) {
      return new myMenuItem(label, options, this, this.parentOptions);
    }
  };

  /** myMenuItem constructor */
  var myMenuItem = function (label, options, parent, parentOptions) {
    this.parent = parent;
    this.defaults = this.parent.defaults;
    this.parentOptions = parentOptions;
    this.options = extend(this.parentOptions, options);
    this.label = label;

    // empty arrays too keep radial item objects
    this.childs = [];
    this.circles = [];
    this.texts = [];

    // push just created menu item to parents items array
    this.parent.childs.push(this);

    // menuItem SVG elements
    this.svg = this.parent.svg;
    this.s = this.parent.s;
    this.mainGroup = this.parent.mainGroup;
    this.g;

    // action flag
    this.isOpened = false;
  };

  myMenuItem.prototype = radialMenu.prototype;

  window.radialMenu = radialMenu;
})(window);
