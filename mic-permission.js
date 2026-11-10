// mic-permission.js - One-time helper tab to grant microphone access for the extension origin

const permStatus = document.getElementById("permStatus");
const retryPermBtn = document.getElementById("retryPermBtn");

async function requestMicrophone() {
  permStatus.classList.remove("error");
  permStatus.textContent = "Please click 'Allow' in the browser popup at the top-left...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks immediately after permission is granted
    stream.getTracks().forEach((track) => track.stop());

    permStatus.textContent = "✓ Microphone enabled! Returning to the Side Panel...";
    retryPermBtn.hidden = true;

    try {
      await chrome.runtime.sendMessage({ type: "MIC_PERMISSION_GRANTED" });
    } catch (_) {
      // Ignore if listener not active
    }

    setTimeout(() => {
      window.close();
    }, 900);
  } catch (err) {
    permStatus.classList.add("error");
    permStatus.textContent =
      "Microphone permission was blocked or dismissed. Click the lock/tune icon in the address bar above, set Microphone to 'Allow', and click the button below.";
    retryPermBtn.hidden = false;
  }
}

retryPermBtn.addEventListener("click", requestMicrophone);

// Trigger automatically on load
requestMicrophone();

