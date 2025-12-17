<script>
    import { page } from '$app/state';
    import logo from '$lib/images/logo.webp';
    import github from '$lib/images/github.svg';

    import { navigateTo } from '$lib/store.js';
    import { componentName } from '$lib/store.js';

    import { HomeSolid, HomeOutline, LanguageOutline, MicrophoneOutline, FileDocOutline, QuestionCircleOutline, UserSettingsOutline, SearchOutline } from "flowbite-svelte-icons";

    export function stopPropagation(handler) {
      return (event) => {
        event.stopPropagation();
        handler(event);
      };
    }
</script>

<header class="flex justify-between">
  <div class="flex cursor-pointer"  >
      <HomeOutline class="shrink-0 h-8 w-8 m-2 text-blue-500 hover:text-pink-500_" onclick={stopPropagation(() => navigateTo.list() )} />
      <!-- <CirclePauseOutline class="shrink-0 h-8 w-8 m-2" color="#26a019"/> -->
      <QuestionCircleOutline class="shrink-0 h-8 w-8 m-2" color="#73cd55"/>
      <FileDocOutline class="shrink-0 h-8 w-8 m-2" color="#43f83d"/>
      <UserSettingsOutline class="shrink-0 h-8 w-8 m-2" color="#43f83d"/>
      <SearchOutline class="shrink-0 h-8 w-8 m-2" color="#d33933"/>
      <LanguageOutline class="shrink-0 h-8 w-8 hover:text-red-500 m-2" color="#82bb5c"/>
  </div>
</header>
