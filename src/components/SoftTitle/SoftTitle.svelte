<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import { writable } from "svelte/store";
    import { smoothScrollTarget } from "../SmoothScrollWrapper/store.ts";

    export let scaleSpeed = 1;
    export let videoURL = "https://videos.pexels.com/video-files/31196472/13325298_2560_1440_25fps.mp4"
    export let direction = 1
    export let offset = 0;
    export let pushToRead = false;
    export let z = false;
    let w = writable({});
    let d = writable({});
    let random = writable("");

    onMount(() => {
        w.set(window);
        d.set(document);
        random.set(String(Math.random()))
    })

    /* ------------------------------------------------------------------
     * ✨ Public props
     * ----------------------------------------------------------------*/
    /** Text that will be rendered with a CRT-style glitch + shadow */
    export let text: string = "Σxecutions";
</script>

<div class="soft" style="top: {pushToRead ? -$smoothScrollTarget : 0}px; {pushToRead && !z ? 'z-index: -1;' : 'z-index: 1;'}">
    <video playsinline muted={true} autoplay loop class="video" src={videoURL}/>
    <h1 class="title">
        <o id={random} style="left: {offset + $smoothScrollTarget * scaleSpeed}px">
            {text}
        </o>
    </h1>
</div>
<div style="z-index: 1; height: {
    pushToRead ? 
        (
            (offset / $w.innerHeight) + 
            ($d?.getElementById?.(random)?.offsetWidth / $w.innerWidth) 
            / scaleSpeed
        )
    : 0
}vh;"/>

<style lang="scss">
    .soft {
        filter: invert(1);
        text-transform: uppercase;
        font-weight: bolder;
        font-family: Helvetica, sans-serif;
        text-wrap-mode: nowrap;
        position: relative;
        top: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;

        o {
            position: relative;
            display: inline-block;
        }
        
        .title {
            margin: 0;
            position: absolute;
            top: 0;
            left: 0;
            font-size: 100vh;
            display: block;
            mix-blend-mode: screen;
            height: 100vh;
            width: 100vw;
            background: white;
            z-index: 1;
            color: black;
        }

        .video {
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            object-fit: cover;
        }
    }
</style>
