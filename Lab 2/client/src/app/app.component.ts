import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService, Task } from './task.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  tasks: Task[] = [];
  filter: string = 'all';

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.taskService.getTasks(this.filter).subscribe(data => this.tasks = data);
  }

  onFilterChange() {
    this.loadTasks();
  }

  onAddTask(form: any, fileInput: HTMLInputElement) {
    const formData = new FormData();
    formData.append('title', form.value.title);
    formData.append('date', form.value.date);
    if (fileInput.files?.[0]) {
      formData.append('file', fileInput.files[0]);
    }
    this.taskService.addTask(formData).subscribe(() => {
      form.resetForm();
      fileInput.value = '';
      this.loadTasks();
    });
  }

  markDone(id: number) {
    this.taskService.markDone(id).subscribe(() => this.loadTasks());
  }

  deleteTask(id: number) {
    this.taskService.deleteTask(id).subscribe(() => this.loadTasks());
  }
}
