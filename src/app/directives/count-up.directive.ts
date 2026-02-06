import { Directive, ElementRef, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
	selector: '[appCountUp]',
	standalone: true
})
export class CountUpDirective implements OnInit, OnChanges {
	@Input('appCountUp') endValue: number = 0;
	@Input() duration: number = 2000;
	@Input() startValue: number = 0;

	@Input() decimalPlaces: number = 0;

	constructor(private el: ElementRef) { }

	ngOnInit() {
		this.animate();
	}

	ngOnChanges(changes: SimpleChanges) {
		if ((changes['endValue'] && !changes['endValue'].firstChange) ||
			(changes['decimalPlaces'] && !changes['decimalPlaces'].firstChange)) {
			this.animate();
		}
	}

	private animate() {
		const start = this.startValue;
		const end = this.endValue;
		const duration = this.duration;
		const decimals = this.decimalPlaces;
		const startTime = performance.now();

		const update = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Easing function: easeOutExpo
			const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

			const current = start + (end - start) * easedProgress;
			this.el.nativeElement.textContent = current.toFixed(decimals);

			if (progress < 1) {
				requestAnimationFrame(update);
			}
		};

		requestAnimationFrame(update);
	}
}
