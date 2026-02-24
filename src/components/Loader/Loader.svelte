<script lang="ts">
    export let visible = false;
  </script>
  
  <!-- svelte-ignore a11y-distracting-elements -->
  {#if visible}
    <div class="loading-screen">
      <div class="wrapper">
        <div class="box-wrap">
          <div class="box one"></div>
          <div class="box two"></div>
          <div class="box three"></div>
          <div class="box four"></div>
          <div class="box five"></div>
          <div class="box six"></div>
        </div>
      </div>
    </div>
  {/if}
  
  <style>
    .loading-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      background: radial-gradient(
        circle at center,
        rgba(22, 22, 22, 0.8) 0%,
        rgba(10, 10, 10, 0.95) 100%
      );
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      display: grid;
      place-items: center;
      z-index: 9999;
      color: white;
    }
  
    .wrapper {
      width: 200px;
      height: 200px;
      background-color: transparent;
      border: none;
      -webkit-user-select: none;
    }
  
    .box-wrap {
      width: 70%;
      height: 70%;
      margin: 15% 15%;
      position: relative;
      transform: rotate(-45deg);
    }
  
    .box-wrap .box {
      width: 100%;
      height: 100%;
      position: absolute;
      left: 0;
      top: 0;
      background: linear-gradient(
        to right,
        #141562,
        #486fbc,
        #eabaa1,
        #8dd6ff,
        #4973c9,
        #d07ca7,
        #f4915e,
        #f5919e,
        #b46f89,
        #141562,
        #486fbc
      );
      background-position: 0% 50%;
      background-size: 1000% 1000%;
      visibility: hidden;
    }
  
    .box-wrap .box.one {
      animation: moveGradient 15s infinite, oneMove 3.5s infinite;
    }
  
    .box-wrap .box.two {
      animation: moveGradient 15s infinite, twoMove 3.5s 0.15s infinite;
    }
  
    .box-wrap .box.three {
      animation: moveGradient 15s infinite, threeMove 3.5s 0.3s infinite;
    }
  
    .box-wrap .box.four {
      animation: moveGradient 15s infinite, fourMove 3.5s 0.575s infinite;
    }
  
    .box-wrap .box.five {
      animation: moveGradient 15s infinite, fiveMove 3.5s 0.725s infinite;
    }
  
    .box-wrap .box.six {
      animation: moveGradient 15s infinite, sixMove 3.5s 0.875s infinite;
    }
  
    @keyframes moveGradient {
      to {
        background-position: 100% 50%;
      }
    }
  
    @keyframes oneMove {
      0% {
        visibility: visible;
        clip-path: inset(0% 35% 70% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      14.2857% {
        clip-path: inset(0% 35% 70% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      28.5714% {
        clip-path: inset(35% 35% 35% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      42.8571% {
        clip-path: inset(35% 70% 35% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      57.1428% {
        clip-path: inset(35% 70% 35% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      71.4285% {
        clip-path: inset(0% 70% 70% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      85.7142% {
        clip-path: inset(0% 70% 70% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      100% {
        clip-path: inset(0% 35% 70% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
    }
  
    @keyframes twoMove {
      0% {
        visibility: visible;
        clip-path: inset(0% 70% 70% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      14.2857% {
        clip-path: inset(0% 70% 70% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      28.5714% {
        clip-path: inset(0% 35% 70% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      42.8571% {
        clip-path: inset(0% 35% 70% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      57.1428% {
        clip-path: inset(35% 35% 35% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      71.4285% {
        clip-path: inset(35% 70% 35% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      85.7142% {
        clip-path: inset(35% 70% 35% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      100% {
        clip-path: inset(0% 70% 70% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
    }
  
    @keyframes threeMove {
      0% {
        visibility: visible;
        clip-path: inset(35% 70% 35% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      14.2857% {
        clip-path: inset(35% 70% 35% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      28.5714% {
        clip-path: inset(0% 70% 70% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      42.8571% {
        clip-path: inset(0% 70% 70% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      57.1428% {
        clip-path: inset(0% 35% 70% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      71.4285% {
        clip-path: inset(0% 35% 70% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      85.7142% {
        clip-path: inset(35% 35% 35% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      100% {
        clip-path: inset(35% 70% 35% 0% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
    }
  
    @keyframes fourMove {
      0% {
        visibility: visible;
        clip-path: inset(35% 0% 35% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      14.2857% {
        clip-path: inset(35% 0% 35% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      28.5714% {
        clip-path: inset(35% 35% 35% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      42.8571% {
        clip-path: inset(70% 35% 0% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      57.1428% {
        clip-path: inset(70% 35% 0% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      71.4285% {
        clip-path: inset(70% 0% 0% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      85.7142% {
        clip-path: inset(70% 0% 0% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      100% {
        clip-path: inset(35% 0% 35% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
    }
  
    @keyframes fiveMove {
      0% {
        visibility: visible;
        clip-path: inset(70% 0% 0% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      14.2857% {
        clip-path: inset(70% 0% 0% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      28.5714% {
        clip-path: inset(35% 0% 35% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      42.8571% {
        clip-path: inset(35% 0% 35% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      57.1428% {
        clip-path: inset(35% 35% 35% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      71.4285% {
        clip-path: inset(70% 35% 0% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      85.7142% {
        clip-path: inset(70% 35% 0% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      100% {
        clip-path: inset(70% 0% 0% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
    }
  
    @keyframes sixMove {
      0% {
        visibility: visible;
        clip-path: inset(70% 35% 0% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      14.2857% {
        clip-path: inset(70% 35% 0% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      28.5714% {
        clip-path: inset(70% 0% 0% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      42.8571% {
        clip-path: inset(70% 0% 0% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      57.1428% {
        clip-path: inset(35% 0% 35% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      71.4285% {
        clip-path: inset(35% 0% 35% 70% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      85.7142% {
        clip-path: inset(35% 35% 35% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
      100% {
        clip-path: inset(70% 35% 0% 35% round 5%);
        animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1);
      }
    }
  
    .loading-text {
      margin-top: 20px;
      font-size: 1.2em;
      height: 2em;
      display: grid;
      place-items: center;
    }
  
    .loading-text span {
      grid-column: 1;
      grid-row: 1;
      opacity: 0;
      transition: opacity 0.5s cubic-bezier(0.42, 0, 0.58, 1);
    }
  
    .loading-text span.visible {
      opacity: 1;
    }
  </style>
