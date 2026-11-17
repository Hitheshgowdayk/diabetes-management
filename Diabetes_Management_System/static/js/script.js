function initGlucoseValidation() {
  const form = document.getElementById("glucose-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    const input = document.getElementById("reading_value");
    const val = parseFloat(input.value);
    if (Number.isNaN(val) || val < 20 || val > 600) {
      e.preventDefault();
      alert("Please enter a valid glucose level between 20 and 600 mg/dL.");
    }
  });
}

function searchHospitals(params) {
  const listEl = document.getElementById("hospital-list");
  if (!listEl) return;
  listEl.innerHTML = "<p>Searching verified OpenStreetMap facilities...</p>";

  fetch(`/api/hospitals?${new URLSearchParams(params).toString()}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        listEl.innerHTML = `<div class="flash flash-error">${data.error}</div>`;
        return;
      }
      if (!data.facilities || data.facilities.length === 0) {
        listEl.innerHTML = "<p>No hospitals or clinics found nearby.</p>";
        return;
      }
      listEl.innerHTML = data.facilities
        .map(
          (f) => `
        <div class="card">
          <strong>${f.name}</strong> (${f.type} · ${f.distance_km} km)<br/>
          <span>${f.address || "Address not listed in OpenStreetMap"}</span><br/>
          <span>${f.phone ? `Phone: ${f.phone}` : "Phone not listed"}</span><br/>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}" target="_blank" rel="noopener">Open Directions</a>
        </div>`
        )
        .join("");
    })
    .catch(() => {
      listEl.innerHTML = '<div class="flash flash-error">Unable to reach OpenStreetMap right now.</div>';
    });
}

document.addEventListener("DOMContentLoaded", () => {
  initGlucoseValidation();
  const gpsBtn = document.getElementById("gps-btn");
  if (gpsBtn) {
    gpsBtn.addEventListener("click", () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => searchHospitals({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {
          const listEl = document.getElementById("hospital-list");
          if (listEl) listEl.innerHTML = '<div class="flash flash-error">Location denied. Use manual search.</div>';
        }
      );
    });
  }
  const manualForm = document.getElementById("manual-hospital-form");
  if (manualForm) {
    manualForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("hospital-query").value.trim();
      if (q) searchHospitals({ q });
    });
  }
});
