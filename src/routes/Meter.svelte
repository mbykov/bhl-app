<script>
    const ledColor = [
        "#064dac",
        "#064dac",
        "#064dac",
        "#06ac5b",
        "#15ac06",
        "#4bac06",
        "#80ac06",
        "#acaa06",
        "#ac8b06",
        "#ac5506",
    ]

    // let leds = [...document.getElementsByClassName('led')]
    // let aaa = document.querySelectorAll('.led')
    // console.log('________________________________________leds', aaa.length)
    /**
     * @param {Float} vol value of volume detected from microphone
     */
    export function showLeds(vol) {
        let leds = [...document.getElementsByClassName('led')]
        // let aaa = document.querySelectorAll('.led')
        // console.log('________________________________________leds', aaa.length)
        let range = leds.slice(0, Math.round(vol))
        // if (Math.round(vol) > 0) console.log('_range', Math.round(vol), range)

        for (var i = 0; i < leds.length; i++) {
            leds[i].style.boxShadow = "-2px -2px 4px 0px #a7a7a73d, 2px 2px 4px 0px #0a0a0e5e";
            leds[i].style.height = "22px"
        }

        for (var i = 0; i < range.length; i++) {
            range[i].style.boxShadow = `5px 2px 5px 0px #0a0a0e5e inset, -2px -2px 1px 0px #a7a7a73d inset, -2px -2px 30px 0px ${ledColor[i]} inset`;
            range[i].style.height = "25px"
        }
    }
</script>

<!-- <div class=""> -->
    <div class="volum-wrapper flex pt-2 pl-4">
        <div class="led h-4 w-4 mr-1"></div>
        <div class="led h-4 w-4 mr-1"></div>
        <div class="led h-4 w-4 mr-1"></div>
        <div class="led h-4 w-4 mr-1"></div>
        <div class="led h-4 w-4 mr-1"></div>

        <div class="led h-4 w-4 mr-1"></div>
        <div class="led h-4 w-4 mr-1"></div>
        <div class="led h-4 w-4 mr-1"></div>
        <div class="led h-4 w-4 mr-1"></div>
        <div class="led h-4 w-4 mr-1"></div>
    </div>

    <!-- <div class="control-audio-wrapper"> -->
    <!--     <div id="audio" class="audio-control">&#127908;</div> -->
    <!-- </div> -->
<!-- </div> -->
