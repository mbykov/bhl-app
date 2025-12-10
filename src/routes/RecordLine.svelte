<script>

  import { TrashBinSolid, EditSolid, MicrophoneSolid } from "flowbite-svelte-icons";

  import { slide } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';

  const log = console.log
  const dispatch = createEventDispatcher();
  let isEditing = false;

  import { componentName, recordItem } from '$lib/store.js';


  let showActions = false;
  function handleTouchStart() {
    showActions = true;
  }
  function handleTouchEnd() {
    // Optional: hide after delay
    setTimeout(() => showActions = false, 2000);
  }

  export let item;

  /**
   * @param {number | string} id - id of the To-do item
   */
  export function deleteItem(id) {
    dispatch('deleteItem', {
      id,
    });
  }

  /**
   * @param {Object} event - event
   * @param {Object} item - To-do item
   * @param {boolean} item.status - status of the To-do item
   * @param {string | number} item.id - id of the To-do item
   */
  function handleClick(event, item) {
    log('_RL_CLICK', item)

    componentName.set('edit');
    recordItem.set(item)

    // if (!item.status) {
    //   dispatch('undoneItem', item);
    // } else {
    //   dispatch('doneItem', item);
    // }
  }

  function handleEdit() {
    isEditing = !isEditing;
  }
</script>


<!-- <li -->
<!--   transition:slide={{ duration: 400 }} -->
<!--   class={`todo-item ` + (!item.status ? '' : 'done')} -->
<!-- > -->


  <!-- svelte-ignore a11y-click-events-have-key-events -->

  <!-- тут группа должна точно работать при наведении:/ -->
  <!-- <div class="group relative"> -->
  <!--   <p>Hover over me (parent)</p> -->
  <!--   <\!-- This div is hidden by default and appears on hover -\-> -->
  <!--   <div class="hidden group-hover:block"> -->
  <!--     I appear on group hover! -->
  <!--   </div> -->
  <!-- </div> -->

  <!-- 1 -->
  <!-- <div class="group flex justify-between outline outline-cyan-200 text-lg p-4 m-2 rounded-md" on:click={(ev) => handleClick(ev, item)}> -->
  <!-- <div class="h-8">{item?.title}</div> -->
  <!-- <div class="hidden md:group-hover:flex group-active:flex"> -->
  <!--   <EditSolid size="md" class="shrink-0 text-gray-500 w-6 h-6 hover:text-red-500" /> -->
  <!--   <TrashBinSolid size="md" class="shrink-0 text-gray-500 w-6 h-6 hover:text-red-500" /> -->
  <!-- </div> -->
  <!-- </div> -->

<!-- 2 -->
<div class="group flex justify-between outline outline-cyan-200 text-lg p-4 m-2 rounded-md" on:click={(ev) => handleClick(ev, item)}>
  <div class="h-8">{item?.title}</div>
  <div class="hidden group-hover:flex touch-manipulation active:flex">
    <EditSolid size="md" class="shrink-0 text-gray-500 w-6 h-6 hover:text-red-500" />
    <TrashBinSolid size="md" class="shrink-0 text-gray-500 w-6 h-6 hover:text-red-500" />
  </div>
</div>

<!-- 3 -->
<!--   <div class="group flex justify-between outline outline-cyan-200 text-lg p-4 m-2 rounded-md" on:click={(ev) => handleClick(ev, item)}> -->
<!--   <div class="h-8">{item?.title}</div> -->
<!--   <\!-- Show on medium+ screens with hover, always show on mobile -\-> -->
<!--   <div class="flex md:hidden lg:group-hover:flex"> -->
<!--     <EditSolid size="md" class="shrink-0 text-gray-500 w-6 h-6 hover:text-red-500" /> -->
<!--     <TrashBinSolid size="md" class="shrink-0 text-gray-500 w-6 h-6 hover:text-red-500" /> -->
<!--   </div> -->
<!-- </div> -->

<!-- 4 -->
  <!-- <div class="group flex justify-between outline outline-cyan-200 text-lg p-4 m-2 rounded-md" on:click={(ev) => handleClick(ev, item)}> -->
  <!-- <div class="h-8">{item?.title}</div> -->

  <!-- <\!-- -->
  <!--   Mobile (default): always show (flex) -->
  <!--   Medium screens (768px+): hide by default, show on hover (hidden md:group-hover:flex) -->
  <!-- -\-> -->
  <!-- <div class="flex md:hidden md:group-hover:flex"> -->
  <!--   <EditSolid size="md" class="shrink-0 text-gray-500 w-6 h-6 hover:text-red-500 md:hover:text-red-500" /> -->
  <!--   <TrashBinSolid size="md" class="shrink-0 text-gray-500 w-6 h-6 hover:text-red-500 md:hover:text-red-500" /> -->
  <!-- </div> -->
  <!-- </div> -->


<!-- </li> -->
