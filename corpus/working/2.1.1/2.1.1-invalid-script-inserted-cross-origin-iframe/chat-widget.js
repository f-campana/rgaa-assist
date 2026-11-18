(function () {
  var frame = document.createElement("iframe");
  frame.setAttribute("src", "__CROSS_ORIGIN__/chat.html");
  frame.style.position = "fixed";
  frame.style.right = "16px";
  frame.style.bottom = "16px";
  frame.style.width = "320px";
  frame.style.height = "200px";
  frame.style.border = "1px solid #888";
  document.body.appendChild(frame);
})();
