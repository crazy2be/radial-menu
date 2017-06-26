// kate: indent-width: 2;
;(function (window) {
  "use strict";
  var xmlns = "http://www.w3.org/2000/svg";

  function merge(...objs) {
    var res = {};
    objs.forEach(obj => {for (var key in obj) { res[key] = obj[key]; }});
    return res;
  }

  function setAttrs(el, obj) { for (var k in obj) { el.setAttribute(k, obj[k]); }}

  // For some reason svg textpaths must be created in a seperate element,
  // and linked to with a href. Don't ask me why this is the system they have,
  // but it is.
  function defsPath(svg, path) {
    var hash32 = s => s.reduce((a,b) => (a = ((a<<5)-a)+b.charCodeAt(0), a&a), 0);
    var hash = s => hash32(s).toString(36) + hash32(s.slice().reverse()).toString(36);
    var pathID = 'path' + hash(path.split(""));
    if (svg.querySelector("#" + pathID)) return pathID;

    var defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(xmlns, "defs");
      svg.appendChild(defs);
    }
    var pathNode = document.createElementNS(xmlns, "path");
    setAttrs(pathNode, {d: path, id: pathID});
    defs.appendChild(pathNode);
    return pathID;
  }

  function circlePoints(step, rBig, rSmall, spacing) {
    var points = [];
    var circleLengthBig   = 2*Math.PI*rBig;
    var circleLengthSmall = 2*Math.PI*rSmall;
    var cos = Math.cos, sin = Math.sin;
    var deg2rad = (deg) => (deg / 180.) * Math.PI;

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
      this.radiusSmall = this.parent ? this.parent.radiusBig + 10 : this.options["start-radius"];
      this.radiusBig = this.radiusSmall + 50;

      var step = 360 / this.childs.length;
      var points = circlePoints(step, this.radiusBig, this.radiusSmall, this.options.spacing);
      this.g = document.createElementNS(xmlns, "g");
      this.mainGroup.appendChild(this.g);

      for (let i = 0; i < points.length - 1; i++) {
        let child = this.childs[i], opts = child.options;
        var item = document.createElementNS(xmlns, "g");
        if (opts.class) item.classList.add(opts.class);
        this.g.appendChild(item);
        this.items.push(item);

        function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
          var angleInRadians = angleInDegrees * Math.PI / 180.0;

          return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
          };
        }

        function describeArc(x, y, radius, startAngle, endAngle, sweep){
          var start = polarToCartesian(x, y, radius, endAngle);
          var end = polarToCartesian(x, y, radius, startAngle);
          var largeArcFlag = (endAngle - startAngle > 180);
          return [
            start.x, start.y,
            "A", radius, radius, 0, ~~largeArcFlag, ~~sweep, end.x, end.y];
        }
        // ### Circle
        // TODO: This rotation logic is not quite right. It looks like it was wrong to begin with.
        // Basically the goal here is to change the diameter of the cicrle drawn when there are
        // only two segments, because otherwise you end up with a visibly distorted "egg" shape.
        var p1 = points[i], p2 = points[i + 1];
        //var rotated = (p1.after.big.x === p2.before.big.x) && !(p1.after.big.y === p2.before.big.y);
        //var adjx = 0;//rotated ? this.options.spacing / 2 : 0.;
        //var adjy = 0;//!rotated ? this.options.spacing / 2 : 0.;
        var circle = document.createElementNS(xmlns, "path");
        var aaaa = 360 / this.childs.length;
        var circ = r => 2*Math.PI*r;

        var circleLengthBig   = 2*Math.PI*this.radiusBig;
        var circleLengthSmall = 2*Math.PI*this.radiusSmall;
//         var cos = Math.cos, sin = Math.sin;
//         var deg2rad = (deg) => (deg / 180.) * Math.PI;
        var step = 360 / this.childs.length;

//     for (var i = 0; i <= 360; i += Number(step.toFixed(1))) {
      var spaceDeg = (this.options.spacing/2) * 360;
//       var beforeSmall = deg2rad(i - spaceDeg/circleLengthBig);
//       var beforeBig   = deg2rad(i - spaceDeg/circleLengthSmall);
//       var afterSmall  = deg2rad(i + spaceDeg/circleLengthBig);
//       var afterBig    = deg2rad(i + spaceDeg/circleLengthSmall);
        setAttrs(circle, merge({
          d: [].concat(
            "M", describeArc(0, 0, this.radiusBig, i*step + spaceDeg/circleLengthBig, (i+1)*step - spaceDeg/circleLengthBig, false),
            "L", describeArc(0, 0, this.radiusSmall, (i+1)*step - spaceDeg/circleLengthSmall, i*step + spaceDeg/circleLengthSmall, true),
                       "Z").join(" "),
          //d: "M " + p1.after.big.x + " " + p1.after.big.y +
          //  " A " + (this.radiusBig-adjx) + " " + (this.radiusBig-adjy) + " 0, 0, 1 " +
          //          p2.before.big.x + " " + p2.before.big.y +
          //  " L " + p2.before.small.x + " " + p2.before.small.y +
          //  " A " + (this.radiusSmall-adjx) + " " + (this.radiusSmall-adjy) + " 0, 0, 0 " +
          //          p1.after.small.x + " " + p1.after.small.y + " Z",
          "cursor": "pointer"
        }));
        circle.onclick = () => {
          if (opts.onclick) opts.onclick();
          child.open(i);
        };
        item.appendChild(circle);

        // ### Text
        var text = document.createElementNS(xmlns, "text");
        setAttrs(text, {
          "text-anchor": "middle",
          "pointer-events": "none",
          "alignment-baseline": "baseline",
        });
        item.appendChild(text);

        // ### Text Path
        var radiusMid = (this.radiusBig + this.radiusSmall) / 2;
        var mid = (a) => (a.big.x + a.small.x)/2  +  " "  +  (a.big.y + a.small.y)/2
        var afterMid = mid(p1.after), beforeMid = mid(p2.before);
        var sweep = ~~(p1.after.big.x <= p2.before.big.x);
        if (sweep) [afterMid, beforeMid] = [beforeMid, afterMid];
        var textPath = document.createElementNS(xmlns, "textPath");
        setAttrs(textPath, {
          "href": "#" + defsPath(this.svg, "M " + beforeMid + " A " + radiusMid + " " + radiusMid + " 0, 0, " + sweep + " " + afterMid),
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
