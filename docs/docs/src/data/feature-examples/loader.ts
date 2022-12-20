export const exampleCode = `
import { useLoaderData } from '@shuvi/runtime';
export default () => {
  const data = useLoaderData();
  return (
    <div>
      <p>{data.hello}</p>
    </div>
  );
}
export const loader = async ctx => {
  await sleep(100);
  return {
    hello: 'world'
  };
};
`.trim()
