const presetSelectorEl = document.getElementById("PresetSelector");
const maxGradeEl = document.getElementById("MaxGradeValue");
const gradeLabelListEl = document.getElementById("GradeLabelList");
const fileNameEl = document.getElementById("FileName");

let maxGrade = maxGradeEl.value;

presetSelectorEl.addEventListener("change", (event) => {
    var preset = event.currentTarget.value;
    gradeLabelListEl.innerHTML = "";

    if (preset == "tierlist") {
        maxGradeEl.value = 6;
         ["F", "D", "C", "B", "A", "S"].forEach(label => {
            addGradeLabel(label);
        });
    }
    else if (preset == "5") {
        maxGradeEl.value = 5;
        for (var label of Array(5).keys()) {
            addGradeLabel(label + 1);
        }
    }
    else if (preset == "10") {
        maxGradeEl.value = 10;
        for (var label of Array(10).keys()) {
            addGradeLabel(label + 1);
        }
    }
    else if (preset == "vibes") {
        maxGradeEl.value = 6;
        addGradeLabel("Ew");
        addGradeLabel("Meh");
        addGradeLabel("Has some appeal");
        addGradeLabel("I could see it on my team");
        addGradeLabel("I want it on my team");
        addGradeLabel("Absolute favorite");
    }
    maxGrade = maxGradeEl.value;
});

maxGradeEl.addEventListener('change', (event) => {
    var numLabels = gradeLabelListEl.childElementCount;
    var newMaxNum = event.currentTarget.value;

    if (newMaxNum > numLabels) {
        while (newMaxNum > numLabels) {
            addGradeLabel(numLabels + 1);
            numLabels += 1;
        }
    }
    else if (newMaxNum < numLabels) {
        while (newMaxNum < numLabels) {
            gradeLabelListEl.lastChild.remove();
            numLabels -= 1;
        }
    }
    maxGrade = newMaxNum;
});

function init() {
    fileNameEl.value = "default";
    maxGradeEl.value = 5;
    for (var label of Array(5).keys()) {
        addGradeLabel(label + 1);
    }
}

//!! Need way to find proper label. User changes to .value don't apply until they submit
function removeGradeLabel(labelEl, label) {
    var index = gradeLabels.findIndex((value) => value == label);
    gradeLabels.splice(index, 1);

    console.log(gradeLabels)
    labelEl.parentNode.remove();
    maxGrade -= 1;
} 

function addGradeLabel(label) {
    var el = document.createElement('span');
    var inputEl = document.createElement('input');
    inputEl.setAttribute('value', label);

    el.appendChild(inputEl);

    var delEl = document.createElement('button');
    delEl.setAttribute('onclick', `removeGradeLabel(this, ${label})`);
    delEl.textContent = "Delete";
    el.appendChild(delEl);

    gradeLabelListEl.appendChild(el);
}

async function startGrading() {
    var gradeLabels = [];
    for (var label of gradeLabelListEl.childNodes) {
        console.log(label)
        gradeLabels.push(label.firstChild.value);
    }
    window.localStorage.setItem('fileName', fileNameEl.value);
    window.localStorage.setItem('gradeLabels', gradeLabels.toString());

    window.location.replace('start-grading.html')
}