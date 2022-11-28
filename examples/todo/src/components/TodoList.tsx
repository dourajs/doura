import { useModel } from 'react-doura'
import { todoModel } from '../models/todo'
import { inputModel } from '../models/form'

export default function TodoList() {
  const { todos, filteredTodos, addTodo, toggleTodo, clear } =
    useModel(todoModel)
  const { value: todoContent, update, reset } = useModel(inputModel)

  return (
    <div>
      <div>
        <input type="text" value={todoContent} onChange={update} />
        <button
          onClick={() => {
            if (todoContent) {
              addTodo(todoContent)
              reset()
            }
          }}
        >
          Add
        </button>
      </div>
      <ul>
        {filteredTodos.map((todo) => {
          console.log('todo', todo.isFinished)
          return (
            <li key={todo.id}>
              <input
                type="checkbox"
                checked={todo.isFinished}
                onChange={() => toggleTodo(todo.id)}
              />
              {todo.content}
            </li>
          )
        })}
      </ul>
      <div>
        <button disabled={!todos.length} onClick={clear}>
          Clear todos
        </button>
      </div>
    </div>
  )
}
