<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { browser } from "$app/environment";
  import store, { latestMessage, socket } from "./store.ts";

  let socketInitialized = false;
  let lastId = "";
  let connecting = false; // Prevent multiple concurrent connection attempts

  async function startSocket() {
    const { configuratorEmail, authCode, apiURL } = get(store);
    if (!configuratorEmail || !authCode) return;

    // If already connected with the same ID, do nothing.
    if (socketInitialized && configuratorEmail === lastId) return;
    // If a connection attempt is in progress, do nothing.
    if (connecting) return;

    // If the user (configuratorEmail) has changed, disconnect the old socket.
    if (socketInitialized && configuratorEmail !== lastId) {
      const oldSocket = get(socket);
      if (oldSocket && oldSocket.connected) {
        oldSocket.disconnect();
        console.log("[SOCKET] Disconnected old socket due to id change");
      }
      socketInitialized = false;
    }

    connecting = true;
    console.log("Connecting socket...");
    // Dynamically import socket.io-client so it only loads in the browser.
    const { io } = await import("socket.io-client");
    const s = io(apiURL(), { path: "/socket-io" });
    socket.set(s);

    // Set up event listeners.
    s.on("connect", () => {
      console.log("[SOCKET CONNECTED]");
      socketInitialized = true;
      connecting = false;
      lastId = configuratorEmail;
    });

    s.on("disconnect", () => {
      console.log("[SOCKET DISCONNECTED]");
      socketInitialized = false;
    });

    s.on("log", (msg: string) => {
      latestMessage.set(msg);
      console.log("[SOCKET LOG]", msg);
    });

    s.on("resetPage", () => {
      s.emit("resetAck");
      console.log("Received resetPage → sent resetAck");
    });

    // Emit the register event after setting up listeners.
    s.emit("register", { id: configuratorEmail, accessCode: authCode });
  }

  onMount(() => {
    if (!browser) return; // Run only in the browser

    const unsubscribe = store.subscribe(() => {
      const { isAuthCodeValid, configuratorEmail, authCode } = get(store);
      if (isAuthCodeValid && configuratorEmail && authCode) {
        console.log(isAuthCodeValid, configuratorEmail, authCode, "SocketClient");
        console.log("Starting socket connection for", configuratorEmail);
        startSocket();
      }
    });

    // Keep the connection alive with periodic pings.
    const pingInterval = setInterval(
      () => {
        const s = get(socket);
        if (s && s.connected) {
          s.emit("ping");
        }
      },
      5 * 60 * 1000
    ); // every 5 minutes

    return () => {
      clearInterval(pingInterval);
      const s = get(socket);
      if (s && s.connected) {
        s.disconnect();
      }
      unsubscribe();
      socketInitialized = false;
    };
  });
</script>
