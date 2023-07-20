const presetSelectorEl = document.getElementById("PresetSelector");
const maxGradeEl = document.getElementById("MaxGradeValue");
const gradeLabelListEl = document.getElementById("GradeLabelList");
const fileNameEl = document.getElementById("FileName");

let maxGrade = maxGradeEl.value;
let gradeLabels = []

presetSelectorEl.addEventListener("change", (event) => {
    var preset = event.currentTarget.value;
    gradeLabelListEl.innerHTML = "";

    if (preset == "tierlist") {
        maxGradeEl.value = 6;
         ["S", "A", "B", "C", "D", "F"].forEach(label => {
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


function removeGradeLabel(labelEl, label) {
    var index = gradeLabels.findIndex((value) => value == label);
    console.log(index)
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
    gradeLabels.push(label);
}

async function startGrading() {
    window.localStorage.setItem('gradeLabels', gradeLabels.toString());
    window.localStorage.setItem('fileName', fileNameEl.value);
    window.location.replace('start-grading.html')
}