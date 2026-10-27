import { Component } from '@angular/core';
import { Placement3dView } from './placement-3d/placement-3d-view';
import { generateSamplePacking } from './core/sample-data';

const sample = generateSamplePacking();

@Component({
  selector: 'app-root',
  imports: [Placement3dView],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly vehicle = sample.vehicle;
  protected readonly boxes = sample.boxes;
}
