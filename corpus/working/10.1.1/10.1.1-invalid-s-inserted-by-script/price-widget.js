(function () {
  var price = document.getElementById("prix");
  var old = document.createElement("s");
  old.textContent = "22 €";
  price.appendChild(document.createTextNode(" au lieu de "));
  price.appendChild(old);
})();
