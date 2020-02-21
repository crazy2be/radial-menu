// kate: indent-width: 2;
;(function (window) {
  "use strict";

  function merge(...objs) {
    var res = {};
    objs.forEach(obj => {for (var key in obj) { res[key] = obj[key]; }});
    return res;
  }

  function setAttrs(el, obj) { for (var k in obj) { el.setAttribute(k, obj[k]); }}

  function createElem(parent, kind, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", kind);
    if (attrs) setAttrs(node, attrs);
    if (parent) parent.appendChild(node);
    return node;
  }
  // For some reason svg textpaths must be created in a seperate element,
  // and linked to with a href. Don't ask me why this is the system they have,
  // but it is.
  function defsPath(svg, path) {
    var hash32 = s => s.reduce((a,b) => (a = ((a<<5)-a)+b.charCodeAt(0), a&a), 0);
    var hash = s => hash32(s).toString(36) + hash32(s.slice().reverse()).toString(36);

    var pathID = 'path' + hash(path.split(""));
    if (svg.querySelector("#" + pathID)) return pathID;

    var defs = svg.querySelector("defs") || createElem(svg, "defs");
    createElem(defs, "path", {d: path, id: pathID});
    return pathID;
  }

  function polarToCartesian(r, angleInDegrees) {
    var theta = angleInDegrees * Math.PI / 180.0;
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  }

  function describeArc(radius, startAngle, endAngle, sweep) {
    var start = polarToCartesian(radius, endAngle);
    var end = polarToCartesian(radius, startAngle);
    var largeArcFlag = Math.abs(endAngle - startAngle) > 180;
    var r = n => n.toFixed(2);
    return [
      r(start.x), r(start.y),
      "A", r(radius), r(radius), 0, ~~largeArcFlag, ~~sweep, r(end.x), r(end.y)];
  }

  function buildSlice(radiusSmall, radiusBig, spacing, steps, i, opts, label, parent, svg) {
    var item = createElem(parent, "g")
    if (opts.class) item.classList.add(opts.class);

    // ### Background
    var circ = r => 2*Math.PI*r;
    var spaceDeg = (spacing/2) * 360;
    var spaceBig = spaceDeg / circ(radiusBig);
    var spaceSmall = spaceDeg / circ(radiusSmall);
    var pieSlice = createElem(item, "path", {
        d: [].concat(
        "M", describeArc(radiusBig, steps[i] + spaceBig, steps[i+1] - spaceBig, false),
        "L", describeArc(radiusSmall, steps[i+1] - spaceSmall, steps[i] + spaceSmall, true),
        "Z").join(" "),
        "cursor": "pointer",
        "style": opts["background-style"],
    })

    // ### Text
    var text = createElem(item, "text", {
        "text-anchor": "middle",
        "pointer-events": "none",
        "alignment-baseline": "baseline",
        "style": opts["text-style"],
    });

    var radiusMid = (radiusBig + radiusSmall) / 2;
    var start = steps[i], end = steps[i+1], sweep = end > 180;
    if (sweep) [start, end] = [end, start];
    var textPath = createElem(text, "textPath", {
        "href": "#" + defsPath(svg, ["M"].concat(describeArc(radiusMid, start, end, sweep)).join(" ")),
        "startOffset": "50%",
        "alignment-baseline": "middle",
    });
    textPath.appendChild(document.createTextNode(label));

    return item;
  }

  var radialMenu = function (options) {
    var defaults = {
      "spacing": 10, // amount of space between menu items
      "start-radius": 50,
      "onclick": null,
      "class": "",
      "background-style": "",
      "text-style": "",
      "size": 1,
      "insert-at": document.body,
      "deg-start": 90,
    };
    this.options = merge(defaults, options);
    this.init();
    this.svg = createElem(this.options["insert-at"], "svg",
          {style: "position: absolute; overflow: visible; left:0; top:0; margin:0; width: 1px; height: 1px;"});
    this.svg.classList.add('radial-menu');
    this.mainGroup = createElem(this.svg, "g");
  };

  radialMenu.prototype = {
    init: function () {
      this.childs = [];
      this.items = [];
    },
    root: function () {
        if (this.parent) return this.parent.root();
        else return this;
    },
    open: function () {
      this.root().close();
      this.svg.style.display = '';
      if (this.parent) {
        this.parent.open();
        var index = this.parent.childs.indexOf(this);
        this.parent.items[index].classList.add('open');
      }
      if (this.g) {
        this.g.style.display = '';
      } else {
        this.buildChildren();
      }
    },
    openAt: function (x, y) {
      this.open();
      this.svg.style.left = x + 'px';
      this.svg.style.top = y + 'px';
    },
    buildChildren: function () {
      this.radiusSmall = this.parent ? this.parent.radiusBig + 10 : this.options["start-radius"];
      this.radiusBig = this.radiusSmall + 50;
      this.g = createElem(this.mainGroup, "g");

      var sum = a => a.reduce((n, i) => n + i, 0);
      var totalSize = sum(this.childs.map(c => c.options.size));
      var deg = this.options['deg-start'], steps = [deg];
      for (let i = 0; i < this.childs.length; i++) {
        deg += this.childs[i].options.size * (360 / totalSize);
        steps.push(deg);
      }

      for (let i = 0; i < this.childs.length; i++) {
        var item = buildSlice(this.radiusSmall, this.radiusBig, this.options.spacing, steps, i,
                              this.childs[i].options, this.childs[i].label, this.g, this.svg);
        item.onclick = (ev) => {
          this.childs[i].open(i);
          var clk = this.childs[i].options.onclick;
          if (clk) clk(ev);
        };
        this.items.push(item);
      }
    },
    close: function () {
      if (this.g) this.g.style.display = "none";
      if (!this.parent) this.svg.style.display = "none";
      this.childs.forEach(c => c.close());
      this.items.forEach(el => el.classList.remove('open'));
    },
    add: function (label, options) {
      var child = new myMenuItem(label, merge(this.options, options), this);
      this.childs.push(child);
      return child;
    }
  };
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
