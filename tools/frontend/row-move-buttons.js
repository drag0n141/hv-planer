        {
          const mk=(label,title,target)=>{
            const b=document.createElement("button");b.type="button";b.className="row-move-btn no-print";
            b.textContent=label;b.title=title;b.setAttribute("aria-label",`${title} (Feld ${f+1} Reihe ${r+1})`);
            b.disabled=target<0||target>=state.rows;
            b.onclick=ev=>{ev.stopPropagation();swapRows(f,r,target)};
            return b;
          };
          railLabel.firstElementChild.append(mk("↑","Reihe nach oben",r-1),mk("↓","Reihe nach unten",r+1));
        }
