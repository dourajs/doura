import { useModel } from 'react-doura'
import { todoModel } from '../models/todo'
import { inputModel } from '../models/form'

export default function TodoList() {
  const [state, action] = useModel(todoModel)
  const [todoContent, { update, reset }] = useModel(inputModel)

  return (
    <div>
      <div>
        <input type="text" value={todoContent.value} onChange={update} />
        <button
          onClick={() => {
            if (todoContent.value) {
              action.addTodo(todoContent.value)
              reset()
            }
          }}
        >
          Add
        </button>
      </div>
      <ul>
        {state.filteredTodos.map((todo) => {
          console.log('todo', todo.isFinished)
          return (
            <li key={todo.id}>
              <input
                type="checkbox"
                checked={todo.isFinished}
                onChange={() => action.toggleTodo(todo.id)}
              />
              {todo.content}
            </li>
          )
        })}
      </ul>
      <div>
        <button disabled={!state.todos.length} onClick={action.clear}>
          Clear todos
        </button>
      </div>
    </div>
  )
}
