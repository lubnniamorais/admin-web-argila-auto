import { SubmitEvent, useId, useState } from 'react';
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react';

import { ErrorAlert } from '../ErrorAlert';
import { SuccessAlert } from '../SuccessAlert';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const inputClassName = `
  w-full
  rounded-xl
  border
  border-border
  bg-background
  px-4
  py-3
  text-foreground
  outline-none
  transition-colors
  focus:border-primary
`;

const labelClassName = 'mb-2 block text-sm font-medium';

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Evita ids fixos (nome/email/...) que duplicariam no DOM se o
  // formulário fosse renderizado mais de uma vez na mesma página.
  const formId = useId();
  const nomeId = `${formId}-nome`;
  const emailId = `${formId}-email`;
  const telefoneId = `${formId}-telefone`;
  const mensagemId = `${formId}-mensagem`;

  // 'FormEvent' foi depreciado pelo @types/react (nunca correspondeu a um
  // evento nativo de verdade); para o evento de submit do <form>, o tipo
  // certo é 'SubmitEvent', que já vem com 'target'/'currentTarget'
  // tipados como HTMLFormElement.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.get('nome'),
          email: formData.get('email'),
          telefone: formData.get('telefone'),
          mensagem: formData.get('mensagem'),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setErrorMessage(data.error ?? 'Não foi possível enviar sua mensagem.');
        setStatus('error');
        return;
      }

      form.reset();
      setStatus('success');
    } catch {
      setErrorMessage('Falha de conexão. Tente novamente em instantes.');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <div>
        <label htmlFor={nomeId} className={labelClassName}>
          Nome *
        </label>

        <input
          id={nomeId}
          name='nome'
          type='text'
          required
          className={inputClassName}
        />
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <div>
          <label htmlFor={emailId} className={labelClassName}>
            E-mail *
          </label>

          <input
            id={emailId}
            name='email'
            type='email'
            required
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor={telefoneId} className={labelClassName}>
            Telefone
          </label>

          <input
            id={telefoneId}
            name='telefone'
            type='tel'
            className={inputClassName}
          />
        </div>
      </div>

      <div>
        <label htmlFor={mensagemId} className={labelClassName}>
          Mensagem *
        </label>

        <textarea
          id={mensagemId}
          name='mensagem'
          required
          rows={5}
          className={`${inputClassName} resize-none`}
        />
      </div>

      {status === 'success' && (
        <SuccessAlert
          icon={<CheckCircleIcon size={20} weight='fill' />}
          message='Mensagem enviada! Em breve entraremos em contato.'
        />
      )}

      {status === 'error' && (
        <ErrorAlert
          icon={<WarningCircleIcon size={20} weight='fill' />}
          message={errorMessage}
        />
      )}

      <button
        type='submit'
        disabled={status === 'submitting'}
        className='
          inline-flex
          items-center
          justify-center
          rounded-2xl
          bg-primary
          px-6
          py-4
          font-medium
          text-primary-foreground
          transition-all
          duration-300
          hover:-translate-y-1
          hover:shadow-lg
          disabled:opacity-60
          disabled:hover:translate-y-0
          disabled:hover:shadow-none
        '
      >
        {status === 'submitting' ? 'Enviando…' : 'Enviar mensagem'}
      </button>
    </form>
  );
}
