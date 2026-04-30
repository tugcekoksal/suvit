class InfiniteScroll extends HTMLElement {
  constructor() {
    super();
    this.initGrid();
    this.init();
    this.page = 1;
  }
 
  init() {
    const observer = new IntersectionObserver(this.revealItem.bind(this), {
      root: null,
      threshold: 1,
    });
    observer.observe(this);
  }
 
  initGrid() {
    const gridOptions = ["#product-grid", ".collection-list"];
    for (let gridName of gridOptions) {
      let grid = document.querySelector(gridName);
      if (grid) {
        this.gridName = gridName;
        this.gridContainer = grid;
        break;
      }
    }
  }

  fetchNextPage(e) {
    if (e <= this.dataset.pageSize) {
      fetch(`?page=${e}`,{ method: "GET", headers: { "Content-Type": "text/html" } })
      .then(response => response.text())
      .then((data) => {
        const t = new DOMParser().parseFromString(data,"text/html");
        const i = t.querySelector(this.gridName).innerHTML;
        this.gridContainer.insertAdjacentHTML("beforeend", i);
        if (e == this.dataset.pageSize) {
          this.innerHTML = `<h2>${this.dataset.endText}</h2>`;
        }
      })
      .catch((e) => {
        console.error("Error:", e);
      });
    }
  }
  revealItem(e, t) {
    const [i] = e;
    if (!i.isIntersecting) return;
    if (i.target) {
      this.page++;
      this.fetchNextPage(this.page);
    }
    if (this.page == this.dataset.pageSize) {
      t.unobserve(i.target);
    }
  }
}
customElements.define("infinite-scroll", InfiniteScroll);

class ViewMore extends HTMLElement {
  constructor() {
    super();
    this.initGrid();
    this.page = 2;
    this.addEventListener('click',this.loadmore);
    this.addEventListener('keydown', (e) =>{
      if (e.key === "Enter") {
        e.preventDefault();
        this.loadmore();
      }
    });
  }
  loadmore() {
    this.fetchNextPage(this.page);
    this.page++;
  }

  initGrid() {
    const gridOptions = ["#product-grid", "#collection-list"];
    for (let gridName of gridOptions) {
      let grid = document.querySelector(gridName);
      if (grid) {
        this.gridName = gridName;
        this.gridContainer = grid;
        break;
      }
    }
  }

  fetchNextPage(e) {
    if (e <= this.dataset.pageSize) {
      fetch(`?page=${e}`,{ method: "GET", headers: { "Content-Type": "text/html" } })
      .then(response => response.text())
      .then((data) => {
        const t = new DOMParser().parseFromString(data,"text/html");
        const i = t.querySelector(this.gridName).innerHTML;
        this.gridContainer.insertAdjacentHTML("beforeend", i);
        if (e == this.dataset.pageSize) {
          this.innerHTML = `<h2>${this.dataset.endText}</h2>`;
        }
      })
      .catch((e) => {
        console.error("Error:", e);
      });
    }
  }
}
customElements.define("view-more", ViewMore);