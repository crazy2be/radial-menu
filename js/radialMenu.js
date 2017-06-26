// kate: indent-width: 2;
;(function (window) {
  "use strict";

  function merge(...objs) {
    var res = {};
    objs.forEach(obj => {for (var key in obj) { res[key] = obj[key]; }});
    return res;
  }

  function setAttrs(el, obj) {
    for (var k in obj) {
      el.setAttribute(k, obj[k]);
    }
  }

  // https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
  function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 20; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  var deg2rad = (deg) => (deg / 180.) * Math.PI;
  var xmlns = "http://www.w3.org/2000/svg";

  function circlePoints(step, rBig, rSmall, spacing) {
    var points = [];
    var circleLengthBig   = 2*Math.PI*rBig;
    var circleLengthSmall = 2*Math.PI*rSmall;

    for (var i = 0; i <= 360; i += Number(step.toFixed(1))) {
      var spaceDeg = (spacing/2) * 360;
      var beforeSmall = deg2rad(i - spaceDeg/circleLengthBig);
      var beforeBig   = deg2rad(i - spaceDeg/circleLengthSmall);
      var afterSmall  = deg2rad(i + spaceDeg/circleLengthBig);
      var afterBig    = deg2rad(i + spaceDeg/circleLengthSmall);
      points.push({
        before: {
          big: {
            x: Math.round(rBig * Math.cos(beforeSmall)),
            y: Math.round(rBig * Math.sin(beforeSmall)),
          },
          small: {
            x: Math.round(rSmall * Math.cos(beforeBig)),
            y: Math.round(rSmall * Math.sin(beforeBig)),
          }
        },
        after: {
          big: {
            x: Math.round(rBig * Math.cos(afterSmall)),
            y: Math.round(rBig * Math.sin(afterSmall)),
          },
          small: {
            x: Math.round(rSmall * Math.cos(afterBig)),
            y: Math.round(rSmall * Math.sin(afterBig)),
          }
        }
      });
    }
    return points;
  };

  /** radialMenu constructor */
  var radialMenu = function (options) {
    var defaults = {
      "spacing": 10, // amount of space between menu items
      "start-radius": 50,
      "onclick": null, //callback, none by default
    };
    this.options = merge(defaults, options);
    this.init();
  };

  radialMenu.prototype = {
    init: function () {
      this.childs = [];
      this.items = [];

      this.isOpened = false;

      if (!this.parent) {
        this.svg = document.createElementNS(xmlns, "svg");
        this.svg.classList.add('radial-menu');
        setAttrs(this.svg, {style: "position: absolute; left:50%; top:50%; margin:0;"});

        this.mainGroup = document.createElementNS(xmlns, "g");
        this.svg.appendChild(this.mainGroup);
      }
    },

    /** get menu holder */
    get: function () {
      return this.mainGroup;
    },

    /** open method for each object */
    open: function () {
      if (this.isOpened) return;

      if (!this.parent) {
        this.insertSvg();
        this.buildChildren();
      } else {
        this.parent.closeAllChildren();
        this.parent.open();
        this.buildChildren();
        this.parent.items.forEach(el => el.classList.remove('open'));
        var index = this.parent.childs.indexOf(this);
        this.parent.items[index].classList.add('open');
      }
    },

    /** creating SVG element and paste it to body */
    insertSvg: function () {
      var body = document.querySelector("body");
      body.insertBefore(this.svg, body.firstChild);
    },

    /** all drawing magic is here */
    buildChildren: function () {
      var step = 360/this.childs.length;
      this.isOpened = true;
      this.radiusSmall = this.parent ? this.parent.radiusBig + 10 : this.options["start-radius"];
      this.radiusBig = this.radiusSmall + 50;

      var points = circlePoints(step, this.radiusBig, this.radiusSmall, this.options.spacing);
      this.g = document.createElementNS(xmlns, "g");
      this.mainGroup.appendChild(this.g);

      for (let i = 0; i < points.length - 1; i++) {
        var item = document.createElementNS(xmlns, "g");
        this.g.appendChild(item);
        this.items.push(item);
        // ### Circle
        // TODO: This rotation logic is not quite right. It looks like it was wrong to begin with.
        // Basically the goal here is to change the diameter of the cicrle drawn when there are
        // only two segments, because otherwise you end up with a visibly distorted "egg" shape.
        var rotated = (points[i].after.big.x === points[i+1].before.big.x) && !(points[i].after.big.y === points[i+1].before.big.y);
        var adjx = (rotated && this.childs[i].options.size == 0.5) ? this.options.spacing / 2 : 0.;
        var adjy = (!rotated && this.childs[i].options.size == 0.5) ? this.options.spacing / 2 : 0.;
        var circle = document.createElementNS(xmlns, "path");
        item.appendChild(circle);
        setAttrs(circle, merge({
          d: "M " + points[i].after.big.x + " " + points[i].after.big.y +
            " A " + (this.radiusBig-adjx) + " " + (this.radiusBig-adjy) + " 0, 0, 1 " +
                    points[i+1].before.big.x + " " + points[i+1].before.big.y +
            " L " + points[i+1].before.small.x + " " + points[i+1].before.small.y +
            " A " + (this.radiusSmall-adjx) + " " + (this.radiusSmall-adjy) + " 0, 0, 0 " +
                    points[i].after.small.x + " " + points[i].after.small.y + " Z",
          "stroke-width": this.options["stroke-width"],
          "cursor": "pointer"
        }));
        circle.onclick = () => {
          if (this.childs[i].options.onclick) {
            this.childs[i].options.onclick();
          }
          this.childs[i].open(i);
        }

        // ### Text Path
        var radiusMid = (this.radiusBig + this.radiusSmall) / 2;
        var mid = (a) => (a.big.x + a.small.x)/2  +  " "  +  (a.big.y + a.small.y)/2
        var afterMid = mid(points[i].after);
        var beforeMid = mid(points[i+1].before);
        var sweep = ~~(points[i].after.big.x <= points[i+1].before.big.x);
        if (sweep) [afterMid, beforeMid] = [beforeMid, afterMid];

        var defsp = this.g.ownerSVGElement;
        var defs = defsp.querySelector("defs");
        if (!defs) {
          defs = document.createElementNS(xmlns, "defs");
          defsp.appendChild(defs);
        }
        var pathID = makeid();
        var path = document.createElementNS(xmlns, "path");
        setAttrs(path, {
          d: "M " + beforeMid + " A " + radiusMid + " " + radiusMid + " 0, 0, " + sweep + " " + afterMid,
          id: pathID,
        });
        defs.appendChild(path);

        // ### Text
        var text = document.createElementNS(xmlns, "text");
        setAttrs(text, {
          "text-anchor": "middle",
          "pointer-events": "none",
          "alignment-baseline": "baseline",
        });
        item.appendChild(text);

        var textPath = document.createElementNS(xmlns, "textPath");
        setAttrs(textPath, {
          "href": "#" + pathID,
          "startOffset": "50%",
          "alignment-baseline": "middle",
        });
        text.appendChild(textPath);

        var textNode = document.createTextNode(this.childs[i].label);
        textPath.appendChild(textNode);
      }
      this.recomputeBounds();
    },

    /** close childs of every item */
    closeAllChildren: function () {
      this.childs.forEach(el => el.close());
    },

    /** closing each circle */
    close: function () {
      if (!this.isOpened) return;

      if (this.g) {
        this.g.parentNode.removeChild(this.g);
        this.g = null;
        this.items = [];
        this.isOpened = false;
        this.closeAllChildren();
      }

      if (!this.parent) {
        this.s.remove();
      }
    },

    recomputeBounds: function () {
      if (!this.childs.length) return;

      var bbox = this.g.getBBox();
      var width = bbox.width, height = bbox.height;
      var cw = parseInt(this.svg.getAttribute('width')) || 0;
      var ch = parseInt(this.svg.getAttribute('height')) || 0;

      if(cw < width && ch < height){
        this.svg.setAttribute("width", width+"px");
        this.svg.setAttribute("data-left", this.svg.style.left);
        this.svg.style.marginLeft =  (-width / 2)+'px';

        this.svg.setAttribute("height", height+"px");
        this.svg.setAttribute("data-top", this.svg.style.top);
        this.svg.style.marginTop =  (-height / 2)+'px';

        setAttrs(this.mainGroup, {transform: 'translate('+width/2+','+height/2+')'});
      }
    },

    /** method to add children */
    add: function (label, options) {
      var child = new myMenuItem(label, merge(this.options, options), this);
      this.childs.push(child);
      return child;
    }
  };

  /** myMenuItem constructor */
  var myMenuItem = function (label, options, parent) {
    this.label = label;
    this.options = options;
    this.parent = parent;

    // menuItem SVG elements
    this.svg = this.parent.svg;
    this.mainGroup = this.parent.mainGroup;

    this.init();
  };

  myMenuItem.prototype = radialMenu.prototype;

  window.radialMenu = radialMenu;
})(window);
