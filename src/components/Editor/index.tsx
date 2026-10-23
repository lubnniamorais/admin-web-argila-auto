import '@mdxeditor/editor/style.css';

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  diffSourcePlugin,
  headingsPlugin,
  InsertTable,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  MDXEditor,
  MDXEditorProps,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor';
import { FieldError } from 'react-hook-form';
import { tv, VariantProps } from 'tailwind-variants';

const editor = tv({
  base: [
    'w-132 h-72 overflow-auto rounded-md border-2 border-WHITE bg-WHITE',
    'mt-8 ml-5 p-3 focus:outline-none -z-10',
    'xs:w-70 sm:w-104 md:w-114 lg:w-128 xl:w-143 2xl:w-160 3xl:w-182',
  ],

  variants: {
    isErrored: {
      true: 'border-RED_500',
    },
  },
});

// type EditorVariants = ComponentProps<'div'> & VariantProps<typeof editor>;
type EditorVariants = MDXEditorProps & VariantProps<typeof editor>;

type EditorProps = EditorVariants & {
  markdown?: string;
  error?: FieldError | null;
};

const Editor = ({ markdown, error = null, ...rest }: EditorProps) => {
  // const markdownText = markdown === undefined ? '' : markdown;
  const markdownText = typeof markdown === 'string' ? markdown : '';

  // PARA LIMPAR
  // const ref = useRef<MDXEditorMethods>(null);

  // useEffect(() => {
  //   if (markdown) {
  //     ref.current?.setMarkdown('');
  //   }
  // }, [markdown]);

  return (
    <div className={editor({ isErrored: !!error })}>
      <MDXEditor
        // ref={ref}
        autoFocus
        markdown={markdownText}
        contentEditableClassName="prose"
        // onChange={(val) => {
        //   // MDXEditor às vezes retorna undefined em produção
        //   const safe = typeof val === 'string' ? val : '';
        //   rest.onChange?.(safe);
        // }}
        plugins={[
          diffSourcePlugin(),
          headingsPlugin(),
          quotePlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          listsPlugin(),
          tablePlugin(),
          thematicBreakPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                {' '}
                <BoldItalicUnderlineToggles />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <CreateLink />
                <Separator />
                <InsertTable />
                <Separator />
                <ListsToggle />
                {/* <Separator />
                <DiffSourceToggleWrapper>{''}</DiffSourceToggleWrapper> */}
              </>
            ),
          }),
        ]}
        {...rest}
      />
    </div>
  );
};

export default Editor;
