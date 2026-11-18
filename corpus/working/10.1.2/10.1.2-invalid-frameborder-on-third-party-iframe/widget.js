(function () {
  var holder = document.createElement("div");
  holder.className = "widget-badge";
  holder.style.position = "fixed";
  holder.style.right = "0";
  holder.style.bottom = "16px";
  var frame = document.createElement("iframe");
  frame.setAttribute("title", "Protection contre les robots");
  frame.setAttribute("src", "__CROSS_ORIGIN__/badge.html");
  frame.setAttribute("width", "256");
  frame.setAttribute("height", "60");
  frame.setAttribute("role", "presentation");
  frame.setAttribute("frameborder", "0");
  frame.setAttribute("scrolling", "no");
  holder.appendChild(frame);
  document.body.appendChild(holder);
})();
