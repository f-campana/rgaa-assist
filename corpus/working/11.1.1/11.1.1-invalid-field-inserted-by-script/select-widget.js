(function () {
  var native = document.getElementById("metier");
  var widget = document.createElement("div");
  widget.className = "choix";
  var current = document.createElement("span");
  current.textContent = native.options[native.selectedIndex].text;
  var input = document.createElement("input");
  input.setAttribute("tabindex", "0");
  input.style.position = "absolute";
  input.style.clip = "rect(0, 0, 0, 0)";
  input.style.width = "1px";
  input.style.height = "1px";
  widget.appendChild(current);
  widget.appendChild(input);
  native.parentNode.insertBefore(widget, native.nextSibling);
})();
