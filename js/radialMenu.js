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
    var cos = Math.cos, sin = Math.sin;

    for (var i = 0; i <= 360; i += Number(step.toFixed(1))) {
      var spaceDeg = (spacing/2) * 360;
      var beforeSmall = deg2rad(i - spaceDeg/circleLengthBig);
      var beforeBig   = deg2rad(i - spaceDeg/circleLengthSmall);
      var afterSmall  = deg2rad(i + spaceDeg/circleLengthBig);
      var afterBig    = deg2rad(i + spaceDeg/circleLengthSmall);
      points.push({
        before: {
          big:   {x: ~~(rBig * cos(beforeSmall)), y: ~~(rBig * sin(beforeSmall))},
          small: {x: ~~(rSmall * cos(beforeBig)), y: ~~(rSmall * sin(beforeBig))}
        },
        after: {
          big:   { x: ~~(rBig * cos(afterSmall)), y: ~~(rBig * sin(afterSmall))},
          small: { x: ~~(rSmall * cos(afterBig)), y: ~~(rSmall * sin(afterBig))}
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
      "onclick": null,
      "class": "",
    };
    this.options = merge(defaults, options);
    this.init();
  };

  radialMenu.prototype = {
    init: function () {
      this.childs = [];
      this.items = [];

      if (!this.parent) {
        this.svg = document.createElementNS(xmlns, "svg");
        this.svg.classList.add('radial-menu');
        setAttrs(this.svg, {style: "position: absolute; left:50%; top:50%; margin:0;"});

        this.mainGroup = document.createElementNS(xmlns, "g");
        this.svg.appendChild(this.mainGroup);
      }
    },

    open: function () {
      if (this.g) return;
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

    insertSvg: function () {
      var body = document.querySelector("body");
      body.insertBefore(this.svg, body.firstChild);
    },

    /** all drawing magic is here */
    buildChildren: function () {
      var step = 360 / this.childs.length;
      this.radiusSmall = this.parent ? this.parent.radiusBig + 10 : this.options["start-radius"];
      this.radiusBig = this.radiusSmall + 50;

      var points = circlePoints(step, this.radiusBig, this.radiusSmall, this.options.spacing);
      this.g = document.createElementNS(xmlns, "g");
      this.mainGroup.appendChild(this.g);

      for (let i = 0; i < points.length - 1; i++) {
        let child = this.childs[i], opts = child.options;
        var item = document.createElementNS(xmlns, "g");
        if (opts.class) item.classList.add(opts.class);
        this.g.appendChild(item);
        this.items.push(item);
        // ### Circle
        // TODO: This rotation logic is not quite right. It looks like it was wrong to begin with.
        // Basically the goal here is to change the diameter of the cicrle drawn when there are
        // only two segments, because otherwise you end up with a visibly distorted "egg" shape.
        var p1 = points[i], p2 = points[i + 1];
        var rotated = (p1.after.big.x === p2.before.big.x) && !(p1.after.big.y === p2.before.big.y);
        var adjx = rotated ? this.options.spacing / 2 : 0.;
        var adjy = !rotated ? this.options.spacing / 2 : 0.;
        var circle = document.createElementNS(xmlns, "path");
        item.appendChild(circle);
        setAttrs(circle, merge({
          d: "M " + p1.after.big.x + " " + p1.after.big.y +
            " A " + (this.radiusBig-adjx) + " " + (this.radiusBig-adjy) + " 0, 0, 1 " +
                    p2.before.big.x + " " + p2.before.big.y +
            " L " + p2.before.small.x + " " + p2.before.small.y +
            " A " + (this.radiusSmall-adjx) + " " + (this.radiusSmall-adjy) + " 0, 0, 0 " +
                    p1.after.small.x + " " + p1.after.small.y + " Z",
          "stroke-width": this.options["stroke-width"],
          "cursor": "pointer"
        }));
        circle.onclick = () => {
          if (opts.onclick) opts.onclick();
          child.open(i);
        };

        // ### Text Path
        var radiusMid = (this.radiusBig + this.radiusSmall) / 2;
        var mid = (a) => (a.big.x + a.small.x)/2  +  " "  +  (a.big.y + a.small.y)/2
        var afterMid = mid(p1.after);
        var beforeMid = mid(p2.before);
        var sweep = ~~(p1.after.big.x <= p2.before.big.x);
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

        var textNode = document.createTextNode(child.label);
        textPath.appendChild(textNode);
      }
      this.recomputeBounds();
    },

    closeAllChildren: function () { this.childs.forEach(el => el.close()); },

    close: function () {
      if (!this.g) return;
      this.g.parentNode.removeChild(this.g);
      this.g = null;
      this.items = [];
      this.closeAllChildren();
    },

    recomputeBounds: function () {
      if (!this.childs.length) return;

      var bbox = this.g.getBBox(), w = bbox.width, h = bbox.height;
      var cw = parseInt(this.svg.getAttribute('width')) || 0;
      var ch = parseInt(this.svg.getAttribute('height')) || 0;
      if (cw >= w && ch >= h) return;

      setAttrs(this.svg, {width: w+"px", height: h+"px"});
      this.svg.style.marginLeft = (-w/2)+'px';
      this.svg.style.marginTop = (-h/2)+'px';
      setAttrs(this.mainGroup, {transform: 'translate('+w/2+','+h/2+')'});
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
