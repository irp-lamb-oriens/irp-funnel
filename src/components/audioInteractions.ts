function play(url: string) {
  var audio = document.createElement("audio");

  // Set the crossOrigin attribute to 'anonymous'
  audio.crossOrigin = "anonymous";

  // Set the source of the audio element
  audio.src = url;

  audio.play();

  audio.remove();
}

export function playTick() {
  play("https://cdn.cosmicjs.com/2b091760-e582-11ef-b333-e101bec29f3d-tick2.mp3");
}


export function playTack() {
  play("https://cdn.cosmicjs.com/2aeba450-e582-11ef-b333-e101bec29f3d-tick.mp3");
}
