import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-root',
  template: `
  <div class="text-center d-flex align-items-center justify-content-center mt-4">
    <span class="fs-1 fw-bold pb-2 title"
          style="background: linear-gradient(to right, #f37d17 0%, #fbd735 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          &nbsp; 1 USD vs. Weakest Currency
    </span>
  </div>
  <div id="chart" class="w-100 h-100" #chart></div>
  `
})
export class AppComponent implements OnInit {

  @ViewChild('chart', { static: true }) myElementRef: ElementRef | any;

  constructor() { }

  async ngOnInit() {
    const chartElement: HTMLElement = this.myElementRef.nativeElement;
    const width: number = chartElement.offsetWidth;
    const margin = { top: 16, right: 200, bottom: 6, left: 100 };
    const barSize: number = 48; // height of the bars
    const n: number = 12; // number of bars in race
    const k: number = 10; // DO NOT UPDATE
    const duration: number =250;
    const height: number = margin.top + barSize * n + margin.bottom;

    // load json and init data
    d3.json('assets/data/data.json').then((data: any) => {
      this.draw(
        data,
        chartElement,
        width,
        height,
        margin,
        barSize,
        n,
        k,
        duration
      );
    });
  }

  async draw(
    data: any,
    chartElement: HTMLElement,
    width: number,
    height: number,
    margin: any,
    barSize: number,
    n: number,
    k: number,
    duration: number
  ) {
    const keyframes: any = [];
    const formatNumber = d3.format(',d');
    const formatDate = d3.utcFormat('%Y');
    const x = d3.scaleLinear([0, 1], [margin.left, width - margin.right]);
    const y = d3
      .scaleBand()
      .domain(d3.range(n + 1) as any)
      .rangeRound([margin.top, margin.top + barSize * (n + 1 + 0.1)])
      .padding(0.1);
    const names = new Set(data.map((d: any) => d.name));
    const datevalues = Array.from(
      d3.rollup(
        data,
        ([d]: any) => +d.value,
        (d: any) => d.date,
        (d) => d.name
      )
    )
      .map(([date, data]: any) => [new Date(date), data])
      .sort(([a]: any, [b]: any) => d3.ascending(a, b));

    const images = new Map(data.map((d: any) => [d.name, `assets/images/${d.image}`]));
    const codes = new Map(data.map((d: any) => [d.name, d.code]));
    const usedColors = new Set<string>();
    const nameframes = d3.groups(
      keyframe().flatMap(([, data]: any) => data),
      (d: any) => d.name
    );
    const prev = new Map(
      nameframes.flatMap(([, data]: any) => d3.pairs(data, (a, b) => [b, a]))
    );
    const next = new Map(nameframes.flatMap(([, data]: any) => d3.pairs(data)));
    const svg = d3.create('svg').attr('viewBox', [0, 0, width, height]);
    const updateBars = bars(svg);
    const updateAxis = axis(svg);
    const updateImages_l = images_left(svg);
    const updateLabels = labels(svg);
    const updateTicker = ticker(svg);
    chartElement.appendChild(svg.node()!);

    for (const keyframe of keyframes) {
      const transition = svg
        .transition()
        .duration(duration)
        .ease(d3.easeLinear);

      // Extract the top bar’s value.
      x.domain([0, keyframe[1][0].value]);
      updateAxis(keyframe, transition);
      updateBars(keyframe, transition);
      updateImages_l(keyframe, transition);
      updateLabels(keyframe, transition);
      updateTicker(keyframe, transition);
      await transition.end();
    }

    function rank(value: any) {
      const data: any = Array.from(names, (name) => ({
        name,
        value: value(name),
        code: codes.get(name),
        image: images.get(name)
      }));
      data.sort((a: any, b: any) => d3.descending(a.value, b.value));
      for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
      return data;
    }

    function keyframe() {
      let ka, a: any, kb, b: any;
      for ([[ka, a], [kb, b]] of d3.pairs(datevalues)) {
        for (let i = 0; i < k; ++i) {
          const t = i / k;
          keyframes.push([
            new Date(ka * (1 - t) + kb * t),
            rank(
              (name: any) => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t
            ),
          ]);
        }
      }
      keyframes.push([new Date(kb), rank((name: any) => b.get(name) || 0)]);
      return keyframes;
    }

    function bars(svg: any) {
      let bar = svg.append('g').attr('fill-opacity', 0.6).selectAll('rect');

      return ([date, data]: any, transition: any) =>
      (bar = bar
        .data(data.slice(0, n), (d: any) => d.name)
        .join(
          (enter: any) =>
            enter
              .append('rect')
              .attr('fill', color)
              .attr('height', y.bandwidth())
              .attr('x', x(0))
              .attr('y', (d: any) => y((prev.get(d) || d).rank))
              .attr('width', (d: any) => x((prev.get(d) || d).value) - x(0)),
          (update: any) => update,
          (exit: any) =>
            exit
              .transition(transition)
              .remove()
              .attr('y', (d: any) => y((next.get(d) || d).rank))
              .attr('width', (d: any) => x((next.get(d) || d).value) - x(0))
        )
        .call((bar: any) =>
          bar
            .transition(transition)
            .attr('y', (d: any) => y(d.rank))
            .attr('width', (d: any) => x(d.value) - x(0))
        ));
    }

    function images_left(svg: any) {
      let image = svg.append("g")
        .selectAll("image");

      return ([date, data]: any, transition: any) => image = image
        .data(data.slice(0, n), (d: any) => d.name)
        .join(
          (enter: any) => enter.append("svg:image")
            .attr("xlink:href", (d: any) => d.image)
            .attr("height", y.bandwidth())
            .attr("transform", (d: any) => `translate(${margin.left - barSize},${y((prev.get(d) || d).rank)})`)
            .text((d: any) => d.name),
          (update: any) => update.attr("xlink:href", (d: any) => d.image),
          (exit: any) => exit.transition(transition).remove()
            .attr("transform", (d: any) => `translate(${margin.left - barSize},${y((next.get(d) || d).rank)})`)
        )
        .call((bar: any) => bar.transition(transition)
          .attr("transform", (d: any) => `translate(${margin.left - barSize},${y(d.rank)})`));
    }

    function labels(svg: any) {
      let label = svg
        .append('g')
        .style('font', 'bold 12px var(--bs-font-sans-serif)')
        .style('font-variant-numeric', 'tabular-nums')
        .attr('text-anchor', 'start') // 'end' for inside & 'start' for outside
        .selectAll('text');

      return ([date, data]: any, transition: any) =>
      (label = label
        .data(data.slice(0, n), (d: any) => d.name)
        .join(
          (enter: any) =>
            enter
              .append('text')
              .attr(
                'transform',
                (d: any) =>
                  `translate(${x((prev.get(d) || d).value)},${y(
                    (prev.get(d) || d).rank
                  )})`
              )
              .attr('y', y.bandwidth() / 2)
              //.attr('x', -6) // Lables at the end & inside the bar
              .attr("x", 2) // Lables at the end & outside the bar
              .attr('dy', '-0.25em')
              .text((d: any) => d.name)
              .call((text: any) =>
                text
                  .append('tspan')
                  .attr('fill-opacity', 0.7)
                  .attr('font-weight', 'normal')
                  //.attr('x', -6) // Lables at the end & inside the bar
                  .attr("x", 2)  // Lables at the end & outside the bar
                  .attr('dy', '1.15em')
              ),
          (update: any) => update,
          (exit: any) =>
            exit
              .transition(transition)
              .remove()
              .attr(
                'transform',
                (d: any) =>
                  `translate(${x((next.get(d) || d).value)},${y(
                    (next.get(d) || d).rank
                  )})`
              )
              .call((g: any) =>
                g
                  .select('tspan')
                  .tween('text', (d: any) =>
                    textTween(d.value, (next.get(d) || d).value)
                  )
              )
        )
        .call((bar: any) =>
          bar
            .transition(transition)
            .attr('transform', (d: any) => `translate(${x(d.value)},${y(d.rank)})`)
            .call((g: any) =>
              g
                .select('tspan')
                .tween('text', (d: any) =>
                  textTween((prev.get(d) || d).value, d.value)
                )
            )
        ));
    }

    function axis(svg: any) {
      const g = svg.append('g').attr('transform', `translate(0,${margin.top})`);

      const axis = d3
        .axisTop(x)
        .ticks(width / 160)
        .tickSizeOuter(0)
        .tickSizeInner(-barSize * (n + y.padding()));

      return (_: any, transition: any) => {
        g.transition(transition).call(axis);
        g.select('.tick:first-of-type text').remove();
        g.selectAll('.tick:not(:first-of-type) line').attr('stroke', 'none');
        g.select('.domain').remove();
      };
    }

    function ticker(svg: any) {
      const now = svg
        .append('text')
        .style('font', `bold ${barSize}px var(--bs-font-sans-serif)`)
        .style('font-variant-numeric', 'tabular-nums')
        .attr('text-anchor', 'end')
        .attr('x', width - 6)
        .attr('y', margin.top + barSize * (n - 0.45))
        .attr('dy', '0.32em')
        .text(formatDate(keyframes[0][0]));

      return ([date]: any, transition: any) => {
        transition.end().then(() => now.text(formatDate(date)));
      };
    }

    function textTween(a: any, b: any) {
      const i = d3.interpolateNumber(a, b);
      return function (this: SVGTextElement, t: any) {
        d3.select(this).text(formatNumber(i(t)));
      };
    }

    function color(d: any) {
      const generateUniqueColor = () => {
        let color = '';
        do {
          color = d3.interpolateRainbow(Math.random());
        } while (usedColors.has(color));
        usedColors.add(color);
        return color;
      };
      var color = d3.schemePaired.slice(0, 12)[d.rank];
      // var color = d3.interpolateRainbow(d.rank / (n - 1));
      if (usedColors.has(color)) {
        return generateUniqueColor();
      } else {
        usedColors.add(color);
        return color;
      }
    }
  }
}
