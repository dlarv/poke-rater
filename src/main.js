const { invoke } = window.__TAURI__.tauri;
const { writeTextFile, readTextFile, BaseDirectory }= window.__TAURI__.fs;
const { dataDir } = window.__TAURI__.path;

const slideContainer = document.getElementById('SlideContainer');
const maxGen = 9;
const fileNameInput = document.getElementById('SetFileName');
const autoFillRulesList = document.getElementById("AutoFill-List")

// Elements/Listeners
let fileName = fileNameInput.value;
fileNameInput.addEventListener('input', () => {
  fileName = fileNameInput.value;
});

document.getElementById("Slide-Mode").addEventListener("keyup", function (event) {
  if (slideContainer.style.display == 'hidden') {
    return;
  }
  if (event.key == 'Backspace') {
    prevSlide();
  }
  else if (event.key == 'Space') {
    event.preventDefault();
    nextSlide();
  }
  else if (doAutoFill && event.key >= '0' && event.key <= '9') {
    var num = Number(event.key)
    autoFillGrades(num);
  }
});

// Init vars
let autoFillRules = []
let slides;
let grades;
let maxSlide;
let slideIndex = 0;
let currentPokemonGroup;

let maxGrade = 5;
let gradeDescriptions = [ 0, 1, 2, 3, 4 ]
let typesList;

// First number entered is applied to other related
let doAutoFill = true;

function openTab(event, id) {
  // Declare all variables
  var i, tabcontent, tablinks;

  // Get all elements with class="tabcontent" and hide them
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(id).style.display = "block";
  event.currentTarget.className += " active";
}

async function load() {
  // Send pokemon data to rust
  // Keep slide data here
  var data = await fetch('./slides.json');
  data = await data.json();
  slides = await invoke('init_list', { slides: data });
  maxSlide = Object.keys(slides).length;

  var autoFillGrades = document.getElementById("AutoFill-Grade");
  var opt;
  for (var i = 0; i < maxGrade; i++) {
    opt = document.createElement('option');
    opt.setAttribute('value', i);
    opt.textContent = gradeDescriptions[i];
    autoFillGrades.appendChild(opt);
  }

  typesList = await invoke('get_all_types');

  document.getElementById('start-tab').click();
  slideIndex = -1;
  nextSlide();
}
async function read(fileName) {
  let contents = await readTextFile(fileName, { dir: BaseDirectory.AppLocalData });
}

// Autofill rules
function autoFillGrades(grade) {
  var selectElements = document.getElementsByTagName("select");
  grade = Math.min(grade, maxGrade - 1)

  for(var i = 0; i < selectElements.length; i++) {
    selectElements[i].value = grade;
    setGrade({currentTarget: {value: grade}}, i);
  }
  doAutoFill = false;
}

function autoFillRuleSelected(obj, id) {
  var valueContainer = document.getElementById(id);
  var opt;
  valueContainer.innerHTML = "";
  if (obj.value == 'gen') {
    for (var i = 1; i <= maxGen; i++) {
      opt = document.createElement('option');
      opt.text = "Generation " + i;
      opt.setAttribute('value', opt.text);
      valueContainer.appendChild(opt);
    }
  }
  else if (obj.value == 'type') {
    for (var i = 0; i < typesList.length; i++) {
      opt = document.createElement('option')
      opt.text = typesList[i];
      opt.setAttribute('value', opt.text + " Type");
      valueContainer.appendChild(opt);
    }
  }
}

function addAutoFillRule(rule1, rule2, val1, val2, useRule2, grade, priority) {
  if (!val1 && !val2) {
    return;
  }
  var ruleContainer = document.createElement('span');
  var rule = {
    type_rule1: null,
    type_rule2: null,
    gen_rule1: null,
    gen_rule2: null,
    grade: Number(grade),
    priority: Number(priority)
  };

  if(val1) {
    ruleContainer.textContent += val1;
    if (rule1 == 'type') {
      rule.type_rule1 = val1.replace(' Type', '')
    } else if (rule1 == 'gen') {
      rule.gen_rule1 = Number(val1.replace('Generation ', ''));
    }
  } 
  if (useRule2 && val1 && val2) {
    ruleContainer.textContent += " && "
  }
  if ((useRule2 || !val1) && val2) {
    ruleContainer.textContent += val2;
    
    if (rule2 == 'type') {
      var val = val2.replace(' Type', '')
      rule.type_rule2 = val
    } else if (rule2 == 'gen') {
      rule.gen_rule2 = Number(val2.replace('Generation ', ''));
    }

  }
  ruleContainer.textContent += ` = Grade: ${grade} | Priority: ${priority}`;

  autoFillRules.push(rule);
  autoFillRulesList.appendChild(ruleContainer);
}

async function applyAutoFillRules() {
  // Sort in ascending order based on priority
  autoFillRules.sort((a, b) => Number(a.priority) - Number(b.priority));

  await invoke('autofill', { rules: autoFillRules });
  
  // Apply new grades to current slide (reload slide)
  slideIndex -= 1;
  nextSlide();

}

// Slides
function _addPokemonToSlide(pokemon, index) {
  console.log('Opened ' + pokemon['name'] + " (" + pokemon['dex_no'] + ")")
  doAutoFill = true;

  var slide = document.createElement('div');
  slide.className = 'slide';

  var img = document.createElement('img')
  img.setAttribute('src', './assets/pics/' + pokemon['dex_no'] + '.jpg')
  slide.appendChild(img)

  var opts = document.createElement('select');
  //!! First pokemon grade is set twice
  opts.setAttribute('onchange', `setGrade(event, ${index})`);
  // Forward & Back button are tabindex=8 & 9
  opts.setAttribute('tabindex', Number(index) + 1)
  var opt;
  for (var i = 0; i < maxGrade; i++) {
    opt = document.createElement('option');
    opt.setAttribute('value', i);
    opt.text = gradeDescriptions[i];
    opts.appendChild(opt);
  }

  slide.appendChild(opts);

  if('grade' in pokemon) {
    opts.value = pokemon.grade;
  } 

  return slide;
}

async function nextSlide() {
  slideIndex += 1;
  if (slideIndex >= maxSlide) {
    slideIndex = 0;
  }

  // Delete old children
  slideContainer.innerHTML = '';
  currentPokemonGroup = slides[slideIndex];

  // Attach new children
  var slide;
  var pokemon;
  for (var index in currentPokemonGroup) {

    pokemon = await invoke('get_pokemon_at', {dexNo: Number(currentPokemonGroup[index])});
    slide = _addPokemonToSlide(pokemon, index);
    slideContainer.appendChild(slide);
  }
  document.getElementsByTagName('select')[0].focus();
}

async function prevSlide() {
  slideIndex -= 1;
  if (slideIndex < 0) {
    slideIndex = maxSlide - 1;
  }
  // Delete old children
  slideContainer.innerHTML = '';
  currentPokemonGroup = slides[slideIndex];


  // Attach new children
  var slide;
  var pokemon;
  for (var index in currentPokemonGroup) {

    pokemon = await invoke('get_pokemon_at', { dexNo: Number(currentPokemonGroup[index]) });
    slide = _addPokemonToSlide(pokemon, index);
    slideContainer.appendChild(slide);
  }
  document.getElementsByTagName('select')[0].focus();
}

// Apply grade to pokemon
async function setGrade(event, index) {
  var num = Number(currentPokemonGroup[index]);
  var value = Number(event.currentTarget.value);

  await invoke('set_grade', { dexNo: num, grade: value });
  document.getElementById("NextSlideButton").focus();
}

async function saveGradebook() {
  var gradebook = await invoke('get_gradebook', { cursor: currentPokemonGroup[0] });
  
  console.log(fileName, gradebook)
  await writeTextFile(`${fileName}`, gradebook, { dir: BaseDirectory.AppLocalData });
}

