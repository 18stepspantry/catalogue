fetch("products.csv")
.then(r=>r.text())
.then(text=>{

const tbody=document.querySelector("#catalogue tbody");

const lines=text.split("\n");

let html="";

let started=false;

for(let i=2;i<lines.length;i++){

let cols=lines[i].split(",");

if(cols.length < 2 || cols.join("").trim() === "") continue;

let product=cols[0].trim();

let size=(cols[1]||"").trim();

let price=(cols[2]||"").trim();

let stock=(cols[3]||"").trim();

if(size==="" && price===""){

html+=`
<tr class="category">
<td colspan="4">${product}</td>
</tr>
`;

continue;

}

html+=`

<tr>

<td>${product}</td>

<td>${size}</td>

<td>${price}</td>

<td>${stock}</td>

</tr>

`;

}

tbody.innerHTML=html;

const search=document.getElementById("search");

search.onkeyup=function(){

const filter=this.value.toLowerCase();

const rows=document.querySelectorAll("#catalogue tbody tr");

rows.forEach(r=>{

if(r.classList.contains("category")) return;

r.style.display=r.innerText.toLowerCase().includes(filter)?"":"none";

});

};

});
