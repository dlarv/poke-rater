const { invoke } = window.__TAURI__.tauri;
const { writeTextFile, readTextFile, exists, BaseDirectory } = window.__TAURI__.fs;

const generalSlideEl = document.getElementById("General-Slide");
const generationSlideEl = document.getElementById("Generation-Slide");
const typingSlideEl = document.getElementById("Typing-Slide");
const combatSlideEl = document.getElementById("Combat-Slide");

// TODO: function used by 2 pages, write in one place and export (DRY)
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
    var grades = window.localStorage.getItem('maxGrade');
    if(!grades) {
        alert("Please load a gradebook")
        window.location.replace('index.html')
    }
    console.log(grades, grades)
    var data = await invoke("analyze", { numGrades: Number(grades)});
    saveDataToJson(data)

    renderGenerationSlide(data['gen_average']);
    renderTypingSlide(data['dual_type_average'], data['single_type_average'], data['typing_average'])
    document.getElementById('start-tab').click();
}

function convertFloats(data) {
    // Floats to 2 decimal
    if(typeof (data) === 'number') {
        data = data.toFixed(2);
    }
    else if(typeof(data) === 'object') {
        for(var item in data) {
            data[item] = convertFloats(data[item]);
        }
    }
    return data;
}

async function saveDataToJson(data) {
    var fileName = window.localStorage.getItem("fileName");

    for(var item in data) {
        data[item] = convertFloats(data[item]);
    }
    console.log(data);
    await writeTextFile(`${fileName}.json`, JSON.stringify(data), { dir: BaseDirectory.AppLocalData });
}

// Populate slides with data
function renderGenerationSlide(data) {
    generationSlideEl.textContent = "";
    var title = document.createElement('h2');
    title.textContent = "Generation"
    generationSlideEl.appendChild(title);

    var el;
    var headerEl;
    var gen;
    var bodyEl;
    for(var i in data) {
        el = document.createElement('span');
        el.setAttribute('class', 'analysis-container');
        headerEl = document.createElement('h3');
        headerEl.textContent = `#${Number(i) + 1}`
        el.appendChild(headerEl);
        
        gen = data.reduce((max, val) => Math.max(Number(max), Number(val)), 0);
        gen = data.findIndex((val) => Number(val) == Number(gen));
        data[gen] = 0

        bodyEl = document.createElement('span');
        bodyEl.setAttribute('class', 'analysis-body');
        bodyEl.textContent = `Generation ${gen + 1}`; 

        el.appendChild(bodyEl);

        generationSlideEl.appendChild(el);
    }
}

function renderTypingSlide(dualTypes, singleTypes, typeAverages) {
    var numTypesEl = document.getElementById("Num-Types");
    dualTypes = Number(dualTypes);
    singleTypes = Number(singleTypes);

    var text = "You prefer ";
    if (dualTypes > singleTypes) {
        text += 'dual-types over single-types: ' + (dualTypes / singleTypes).toFixed(2);
    } else {
        text += 'single-types over dual-types ' + (singleTypes / dualTypes).toFixed(2);
    }
    numTypesEl.textContent = text;
    
    var columns = [
        document.getElementById("Slide-1"),
        document.getElementById("Slide-2"),
        document.getElementById("Slide-3")
    ];

    var typeName;
    var headerEl;
    var colIndex;
    for (var i in typeAverages) {
        el = document.createElement('span');
        el.setAttribute('class', 'analysis-container');
        headerEl = document.createElement('h3');
        headerEl.textContent = `#${Number(i) + 1}`
        el.appendChild(headerEl);
        
        typeName = typeAverages[i][0];

        bodyEl = document.createElement('span');
        bodyEl.setAttribute('class', 'analysis-body');
        bodyEl.textContent = `${typeName}`;

        el.appendChild(bodyEl);

        colIndex = parseInt(Number(i) / 6); 
        columns[colIndex].appendChild(el);
    }

}

