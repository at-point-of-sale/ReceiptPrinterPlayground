import { mount } from 'svelte';

import './app.css'
import Inspector from './Inspector.svelte'

const inspector = mount(Inspector, { target: document.getElementById("app") });

export default inspector
