<script lang="ts">
  import { recordItem } from '$lib/store.js';
  import { Button } from 'flowbite-svelte';

  import { SherpaASRClient } from '$lib/asr-client.js';

  const log = console.log

  let record = $state($recordItem);

  import { onMount, onDestroy } from 'svelte';

  let context;
  let audioContext: AudioContext;
  // let oscillator: OscillatorNode;
  let workletNode: AudioWorkletNode;

  let listenButton
  let stopButton


  let source;
  let processor;
  let streamLocal;
  let webSocket;
  let inputArea;
  let sampleRate = 8000;

  // const wsURL = 'ws://localhost:2700'; // старые модели Воск через docker
  const wsURL = 'ws://localhost:6006'; // sherpa

  let initComplete = false;
  let totalText = ''
  let partialText = ''

  const bufferSize = 8192;


  onMount(async () => {
      window.asrClient = new SherpaASRClient();

      inputArea = document.getElementById('inputArea');

      listenButton = document.getElementById('listen');
      stopButton = document.getElementById('stop');
  });

  onDestroy(() => {
      if (workletNode) {
          workletNode.disconnect();
      }
      if (audioContext) {
          audioContext.close();
      }
  });

  // worklet
  function handleStop() {
      if (initComplete !== true) return

      streamLocal.getTracks().forEach((track) => track.stop());
      webSocket.send('{"eof" : 1}');
      webSocket.close();

      listenButton.style.color = 'black';
      listenButton.disabled = false;
      initComplete = false;
      // inputArea.innerText = ""
  }

  const handleSuccess = async function (stream_) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamLocal = stream;

      log('_sampleRate', sampleRate)

      audioContext = new AudioContext({sampleRate: sampleRate});

      const source = audioContext.createMediaStreamSource(stream);

      await audioContext.audioWorklet.addModule("data-conversion-processor.js");

      const processorNode = new AudioWorkletNode(
          audioContext,
          "data-conversion-processor",
      );

      source.connect(processorNode).connect(audioContext.destination);
      // Optional: Listen for messages from the worklet processor
      processorNode.port.onmessage = (event) => {
          // console.log('Message from worklet:', event.data);
          if (webSocket && webSocket.readyState !== WebSocket.CLOSED) {
              webSocket.send(event.data)
          }
      };
  }

  function handleStart() {
      listenButton.disabled = true;
      initWS()

      navigator.mediaDevices.getUserMedia({
          audio: {
              echoCancellation: true,
              noiseSuppression: true,
              channelCount: 1,
              sampleRate
          }, video: false
      }).then(handleSuccess);
      listenButton.style.color = 'green';
      initComplete = true;
  }

  function initWS() {
      webSocket = new WebSocket(wsURL);
      webSocket.binaryType = "arraybuffer";

      webSocket.onopen = function (event) {
          console.log('New connection established');
      };

      webSocket.onerror = function (event) {
          console.error('event.data', event.data);
      };

      webSocket.onmessage = function (event) {
          // console.log('onmessage start');
          if (event.data) {
              let parsed = JSON.parse(event.data);
              // console.log('onmessage', event.data);
              // console.log('onmessage, parsed', parsed);

              if (parsed.partial) console.log('_partial', parsed.partial);
              else if (parsed.result) console.log('_result', parsed.result);

              if (parsed.text) console.log('_text', parsed.text);
              // if (parsed.text) inputArea.innerText += parsed.text;

              if (parsed.text) {
                  totalText += '\n\nABZ' + parsed.text
                  partialText = ''
              }
              if (parsed.partial) {
                  inputArea.innerText = totalText + '\n\n|| ' + parsed.partial
              }

          }
      };
  }

</script>

<!-- <p>Status: {$connectionStatus}</p> -->
<!-- <button on:click={toggleAudio}>Toggle Audio ({audioContext?.state})</button> -->

<div class="container">
  container
  <div id="status"> status </div>
</div>

<!-- <Button id="button" color="blue" onclick={handleStart}>Blue</Button> -->

<!-- <button id="listen" onclick={handleStart}>handle Start</button> -->
<!-- <button id="stop" onclick={handleStop}>handle Stop</button> -->
<button id="startBtn" >handle Start</button>
<button id="stopBtn" >handle Stop</button>


<div id="messages" class="w-full h-full">
    <textarea class="w-full h-full" id="inputArea" rows_="15" cols_="25"></textarea>
</div>

<div id="transcript" class="recordContainer w-full h-full ">
  transcript
</div>


<div class="recordContainer w-full h-full ">

  <div class="record-title w-full h-8 p-2 mb-2" >
    {record.title}
  </div>
  <div class="record-text w-full h-full px-2" contenteditable=true>
    {record.text}
  </div>
</div>
