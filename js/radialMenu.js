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
      this.g = document.createElementNS(xmlns, "g");
      this.mainGroup.appendChild(this.g);

      for (let i = 0; i < this.childs.length; i++) {
        let opts = this.childs[i].options;
        var item = document.createElementNS(xmlns, "g");
        if (opts.class) item.classList.add(opts.class);
        this.g.appendChild(item);
        this.items.push(item);

        // ### Circle
        var circle = document.createElementNS(xmlns, "path");
        var circ = r => 2*Math.PI*r;
        var step = 360 / this.childs.length;
        var spaceDeg = (this.options.spacing/2) * 360;
        var spaceBig = spaceDeg / circ(this.radiusBig);
        var spaceSmall = spaceDeg / circ(this.radiusSmall);
        setAttrs(circle, merge({
          d: [].concat(
            "M", describeArc(0, 0, this.radiusBig, i*step + spaceBig, (i+1)*step - spaceBig, false),
            "L", describeArc(0, 0, this.radiusSmall, (i+1)*step - spaceSmall, i*step + spaceSmall, true),
            "Z").join(" "),
          "cursor": "pointer"
        }));
        circle.onclick = () => {
          if (opts.onclick) opts.onclick();
          this.childs[i].open(i);
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
        var spaceMid = spaceDeg / circ(radiusMid);
        var start = i*step - spaceMid, end = (i+1)*step - spaceMid;
        var sweep = end > 180;
        if (sweep) [start, end] = [end, start];
        var textPath = document.createElementNS(xmlns, "textPath");
        setAttrs(textPath, {
          "href": "#" + defsPath(this.svg, ["M"].concat(describeArc(0, 0, radiusMid, start, end, sweep)).join(" ")),
          "startOffset": "50%",
          "alignment-baseline": "middle",
        });
        text.appendChild(textPath);

        var textNode = document.createTextNode(this.childs[i].label);
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
